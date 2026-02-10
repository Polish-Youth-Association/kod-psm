import { createApp, listen } from "@kod-psm/http-helpers";
import crypto from "node:crypto";
import { getDirectoryClient } from "./workspaceDirectory";
import { sendOnboardingEmail } from "./gmail";
import { sendVolunteerAgreementEnvelope } from "./docusign";
import { ONBOARDING_TEMPLATE_HTML } from "./onboardingTemplate";
import { ONBOARDING_TEMPLATE_PSM_HTML } from "./onboardingTemplatePsmInbox";

const PORT = Number(process.env.PORT) || 8080;

type VolunteerOnboardingPayload = {
  firstName: string;
  lastName: string;
  personalEmail: string;
  team: string;
  startDate?: string;
  notes?: string;
  suggestedPrimaryEmail?: string;
};

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
          orgUnitPath
        }
      });

      const createdEmail = created.data.primaryEmail || primaryEmail;

      // Send onboarding email to personal email
      let emailStatus: "Sent" | "Failed" = "Sent";
      let emailError: string | undefined;

      try {
        const slackInviteLink = process.env.SLACK_INVITE_LINK?.trim() || "";

        await sendOnboardingEmail({
          toPersonalEmail: String(body.personalEmail).trim(),
          firstName: String(body.firstName).trim(),
          team: String(body.team).trim(),
          polishYouthEmail: createdEmail,
          tempPassword,
          htmlTemplate: ONBOARDING_TEMPLATE_HTML
        });
        await sendOnboardingEmail({
          toPersonalEmail: createdEmail,           // reuse the same function arg name (or rename)
          firstName: String(body.firstName).trim(),
          team: String(body.team).trim(),
          polishYouthEmail: createdEmail,
          tempPassword: "",                        // or omit if you change function signature
          htmlTemplate: ONBOARDING_TEMPLATE_PSM_HTML,
          slackInviteLink,
        });
      } catch (e: any) {
        emailStatus = "Failed";
        emailError = e?.message ?? String(e);
        // Don't log the password or full HTML
        console.error("onboarding email failed", { requestId, emailStatus, emailError });
      }

      let docusignStatus: "Sent" | "Skipped" | "Failed" = "Skipped";
      let docusignEnvelopeId: string | undefined;
      let docusignError: string | undefined;

      const templateId = process.env.DS_TEMPLATE_VOLUNTEER_AGREEMENT?.trim();

      if (templateId) {
        try {
          const signerName = `${String(body.firstName).trim()} ${String(body.lastName).trim()}`.trim();
          const out = await sendVolunteerAgreementEnvelope({
            signerEmail: String(body.personalEmail).trim(), // or createdEmail if you prefer
            signerName,
            templateId,
          });

          docusignStatus = "Sent";
          docusignEnvelopeId = out.envelopeId;
        } catch (e: any) {
          docusignStatus = "Failed";
          docusignError = e?.message ?? String(e);
          console.error("docusign send failed", { requestId, docusignError });
        }
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
          envelopeId: docusignEnvelopeId,
          error: docusignError
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