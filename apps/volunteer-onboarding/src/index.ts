import { createApp, listen } from "@kod-psm/http-helpers";
import crypto from "node:crypto";
import { getDirectoryClient } from "./workspaceDirectory";
import { sendOnboardingEmail } from "./gmail";
import { ONBOARDING_TEMPLATE_HTML } from "./onboardingTemplate";
import { ONBOARDING_TEMPLATE_PSM_HTML } from "./onboardingTemplatePsmInbox";
import { triggerSlackDocusignWorkflow } from "./slack";
import { buildPolishYouthSignatureHtml, setGmailSignatureForUser } from "./gmailSignature";

const PORT = Number(process.env.PORT) || 8080;

type VolunteerOnboardingPayload = {
  firstName: string;
  lastName: string;
  personalEmail: string;
  team: string;
  startDate?: string;
  notes?: string;
  suggestedPrimaryEmail?: string;
  phoneNumber?: string;
  birthday?: string;
  title?: string;
};

async function waitForWorkspaceUser(directory: any, userId: string) {
  const timeout = 30000; // 30 seconds max
  const interval = 2000; // check every 2 seconds
  const start = Date.now();

  while (true) {
    try {
      const res = await directory.users.get({
        userKey: userId,
        projection: "full"
      });

      return res.data; // user is ready
    } catch (err: any) {
      if (err.code !== 404) {
        throw err; // real error
      }

      if (Date.now() - start > timeout) {
        throw new Error("Workspace user provisioning timeout");
      }

      await new Promise((r) => setTimeout(r, interval));
    }
  }
}

function newId() {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

function toEmailLocalPart(first: string, last: string) {
  return `${first}.${last}`
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function generateTempPassword() {
  const prefix = process.env.WORKSPACE_TEMP_PASSWORD_PREFIX || "Psm!";
  // strong enough, avoids weird characters
  return `${prefix}${crypto.randomBytes(12).toString("base64url")}A1`;
}


const app = createApp((router) => {
  router.get("/", (_req, res) => {
    res.json({ ok: true, service: "volunteer-onboarding" });
  });

  router.post("/v1/onboarding/volunteers", async (req, res) => {
    const body = (req.body ?? {}) as Partial<VolunteerOnboardingPayload>;

    if (!body.firstName || !body.lastName || !body.personalEmail || !body.team) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: firstName, lastName, personalEmail, team"
      });
    }

    if (!isEmail(body.personalEmail)) {
      return res.status(400).json({ ok: false, error: "personalEmail is not valid" });
    }

    const requestId = newId();

    const domain = (process.env.WORKSPACE_DOMAIN || "polishyouth.org").trim();
    const local = toEmailLocalPart(body.firstName, body.lastName);
    const primaryEmail =
      (body.suggestedPrimaryEmail && String(body.suggestedPrimaryEmail).includes("@"))
        ? String(body.suggestedPrimaryEmail).trim()
        : `${local}@${domain}`;

    const orgUnitPath = (process.env.DEFAULT_ORG_UNIT || "/").trim();
    const tempPassword = generateTempPassword();

    try {
      const directory = await getDirectoryClient();

      // Create Workspace user
      const created = await directory.users.insert({
        requestBody: {
          primaryEmail,
          name: {
            givenName: String(body.firstName).trim(),
            familyName: String(body.lastName).trim()
          },
          password: tempPassword,
          changePasswordAtNextLogin: true,
          recoveryEmail: String(body.personalEmail).trim(),
          orgUnitPath,
      
          ...(body.phoneNumber && String(body.phoneNumber).trim()
            ? {
                phones: [
                  {
                    type: "mobile",
                    value: String(body.phoneNumber).trim()
                  }
                ]
              }
            : {}),
      
          ...(body.title && String(body.title).trim()
            ? {
                organizations: [
                  {
                    title: String(body.title).trim(),
                    primary: true
                  }
                ]
              }
            : {}),
      
          ...(body.birthday && String(body.birthday).trim()
            ? (() => {
                const [y, m, d] = String(body.birthday).trim().split("-").map(Number);
                if (!y || !m || !d) return {};
                return {
                  birthdays: [
                    {
                      date: { year: y, month: m, day: d }
                    }
                  ]
                };
              })()
            : {})
        }
      });

      await waitForWorkspaceUser(directory, primaryEmail);

      const createdEmail = created.data.primaryEmail || primaryEmail;

      let signatureStatus: "Set" | "Failed" = "Set";
      let signatureError: string | undefined;

      try {
        const signatureHtml = buildPolishYouthSignatureHtml({
          firstName: String(body.firstName).trim(),
          lastName: String(body.lastName).trim(),
          email: createdEmail,
          title: String(body.title).trim()
        });

        await setGmailSignatureForUser({
          userEmail: createdEmail,
          signatureHtml,
          retries: 2,
        });
      } catch (e: any) {
        signatureStatus = "Failed";
        signatureError = e?.message ?? String(e);
        console.error("signature update failed", { requestId, signatureError });
      }
      // Send onboarding email to personal email
      let emailStatus: "Sent" | "Failed" = "Sent";
      let emailError: string | undefined;

      try {
        const slackInviteLink = process.env.SLACK_INVITE_LINK?.trim() || "";

        await sendOnboardingEmail({
          toPersonalEmail: String(body.personalEmail).trim(),
          firstName: String(body.firstName).trim(),
          title: String(body.title).trim(),
          polishYouthEmail: createdEmail,
          tempPassword,
          slackInviteLink,
          htmlTemplate: ONBOARDING_TEMPLATE_HTML
        });
        
        await sendOnboardingEmail({
          toPersonalEmail: createdEmail,
          firstName: String(body.firstName).trim(),
          title: String(body.title).trim(),
          polishYouthEmail: createdEmail,
          tempPassword: "—",
          slackInviteLink,
          htmlTemplate: ONBOARDING_TEMPLATE_PSM_HTML
        });

        
      } catch (e: any) {
        emailStatus = "Failed";
        emailError = e?.message ?? String(e);
        // Don't log the password or full HTML
        console.error("onboarding email failed", { requestId, emailStatus, emailError });
      }

      let docusignStatus: "Sent" | "Failed" = "Sent";
      let docusignError: string | undefined;

      try {
        const email = String(body.personalEmail).trim();
        const name = `${String(body.firstName).trim()} ${String(body.lastName).trim()}`.trim();

        await triggerSlackDocusignWorkflow(email, name);
      } catch (e: any) {
        docusignStatus = "Failed";
        docusignError = e?.message ?? String(e);
        console.error("slack workflow trigger failed", { requestId, docusignError });
      }

      return res.status(200).json({
        ok: true,
        requestId,
        status: "Provisioned",
        user: {
          id: created.data.id,
          primaryEmail: createdEmail
        },
        email: {
          status: emailStatus,
          error: emailError
        },
        docusign: {
          status: docusignStatus,
          error: docusignError
        },
        signature: {
          status: signatureStatus,
          error: signatureError
        }
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);

      // common: user exists already (Directory API returns 409)
      const status = err?.code === 409 ? 409 : 500;

      return res.status(status).json({
        ok: false,
        requestId,
        error: msg
      });
    }
  });
});

listen(app, PORT, () => {
  console.log("🚀 volunteer-onboarding running on port " + PORT);
});