import { createApp, listen } from "@kod-psm/http-helpers";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import crypto from "node:crypto";

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

async function getDirectoryClient() {
  const subject = process.env.WORKSPACE_IMPERSONATE_ADMIN?.trim();
  if (!subject) throw new Error("WORKSPACE_IMPERSONATE_ADMIN is not set");

  // DWD: use service account + subject impersonation
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/admin.directory.user"],
    clientOptions: { subject }
  });

  const directory = google.admin({
    version: "directory_v1",
    auth
  });

  return directory;
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

      // NOTE: don't return tempPassword long-term. Useful for first test.
      return res.status(200).json({
        ok: true,
        requestId,
        status: "Provisioned",
        user: {
          id: created.data.id,
          primaryEmail: created.data.primaryEmail
        },
        // REMOVE after testing:
        tempPassword
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