import { createApp, listen } from "@kod-psm/http-helpers";
import crypto from "node:crypto";
import { getDirectoryClient } from "./workspaceDirectory";
import { sendOnboardingEmail } from "./gmail";
import { ONBOARDING_TEMPLATE_HTML } from "./onboardingTemplate";
import { ONBOARDING_TEMPLATE_PSM_HTML } from "./onboardingTemplatePsmInbox";
import { triggerSlackDocusignWorkflow } from "./slack";
import { buildPolishYouthSignatureHtml, setGmailSignatureForUser } from "./gmailSignature";

// NEW
import { createJob, getJob, patchJob } from "./jobs";
import { enqueueTask } from "./tasks";

const PORT = Number(process.env.PORT) || 8080;

type VolunteerOnboardingPayload = {
  firstName: string;
  lastName: string;
  personalEmail: string;
  team: string;
  startDate?: string;
  notes?: string;
  suggestedPrimaryEmail?: string;
  phoneNumber: string;
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

  // Optional: allow frontend to poll job status
  router.get("/v1/onboarding/jobs/:jobId", async (req, res) => {
    try {
      const jobId = String(req.params.jobId || "");
      const job = await getJob(jobId);
      return res.status(200).json({ ok: true, job });
    } catch (e: any) {
      return res.status(404).json({ ok: false, error: e?.message ?? String(e) });
    }
  });

  /**
   * PUBLIC ENTRYPOINT:
   * Validates input, creates a job in Firestore, enqueues Step 1, returns immediately.
   */
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

    const jobId = newId();

    await createJob({
      jobId,
      status: "QUEUED",
      step: "CREATE_USER",
      payload: body,
      data: {},
      steps: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await enqueueTask({
      path: "/tasks/onboarding/create-user",
      payload: { jobId },
    });

    return res.status(202).json({ ok: true, jobId, status: "QUEUED" });
  });

  /**
   * STEP 1: Create Workspace User
   */
  router.post("/tasks/onboarding/create-user", async (req, res) => {
    const jobId = String(req.body?.jobId || "");
    if (!jobId) return res.status(400).json({ ok: false, error: "missing jobId" });

    const job = await getJob(jobId);
    if (job.steps?.createUser?.status === "DONE") return res.json({ ok: true, skipped: true });

    try {
      await patchJob(jobId, {
        status: "RUNNING",
        step: "CREATE_USER",
        "steps.createUser": { status: "RUNNING", at: Date.now() },
      });

      const body = job.payload as VolunteerOnboardingPayload;

      const domain = (process.env.WORKSPACE_DOMAIN || "polishyouth.org").trim();
      const local = toEmailLocalPart(body.firstName, body.lastName);
      const primaryEmail =
        (body.suggestedPrimaryEmail && String(body.suggestedPrimaryEmail).includes("@"))
          ? String(body.suggestedPrimaryEmail).trim()
          : `${local}@${domain}`;

      const phoneNumber = body.phoneNumber ? String(body.phoneNumber).trim() : "";
      const orgUnitPath = (process.env.DEFAULT_ORG_UNIT || "/").trim();
      const tempPassword = generateTempPassword();

      const directory = await getDirectoryClient();

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
          phones: [{ value: phoneNumber, type: "mobile" }]
        }
      });

      const createdEmail = created.data.primaryEmail || primaryEmail;

      await patchJob(jobId, {
        step: "SET_SIGNATURE",
        "data.primaryEmail": primaryEmail,
        "data.workspaceEmail": createdEmail,
        "data.tempPassword": tempPassword,
        "steps.createUser": { status: "DONE", at: Date.now() },
      });

      // replace your sleep(10s) with a delayed task to allow provisioning to settle
      await enqueueTask({
        path: "/tasks/onboarding/set-signature",
        payload: { jobId },
        delaySeconds: 15,
      });

      return res.json({ ok: true });
    } catch (e: any) {
      await patchJob(jobId, {
        status: "FAILED",
        "steps.createUser": { status: "FAILED", at: Date.now(), error: e?.message ?? String(e) },
      });
      // non-2xx triggers Cloud Tasks retry
      return res.status(500).json({ ok: false });
    }
  });

  /**
   * STEP 2: Set Gmail Signature
   */
  router.post("/tasks/onboarding/set-signature", async (req, res) => {
    const jobId = String(req.body?.jobId || "");
    if (!jobId) return res.status(400).json({ ok: false, error: "missing jobId" });

    const job = await getJob(jobId);
    if (job.steps?.setSignature?.status === "DONE") return res.json({ ok: true, skipped: true });

    try {
      await patchJob(jobId, {
        step: "SET_SIGNATURE",
        "steps.setSignature": { status: "RUNNING", at: Date.now() },
      });

      const body = job.payload as VolunteerOnboardingPayload;
      const createdEmail = String(job.data?.workspaceEmail || "").trim();
      if (!createdEmail) throw new Error("Missing job.data.workspaceEmail");

      const signatureHtml = buildPolishYouthSignatureHtml({
        firstName: String(body.firstName).trim(),
        lastName: String(body.lastName).trim(),
        email: createdEmail,
      });

      await setGmailSignatureForUser({
        userEmail: createdEmail,
        signatureHtml,
        retries: 2,
      });

      await patchJob(jobId, {
        step: "SEND_EMAILS",
        "steps.setSignature": { status: "DONE", at: Date.now() },
      });

      await enqueueTask({
        path: "/tasks/onboarding/send-emails",
        payload: { jobId },
        delaySeconds: 10,
      });

      return res.json({ ok: true });
    } catch (e: any) {
      await patchJob(jobId, {
        // NOTE: signature failing shouldn't block whole onboarding if you don't want it to.
        // If you prefer "continue anyway", mark step as FAILED but keep status RUNNING.
        // For now, we fail the job so you notice.
        status: "FAILED",
        "steps.setSignature": { status: "FAILED", at: Date.now(), error: e?.message ?? String(e) },
      });
      return res.status(500).json({ ok: false });
    }
  });

  /**
   * STEP 3: Send onboarding emails
   */
  router.post("/tasks/onboarding/send-emails", async (req, res) => {
    const jobId = String(req.body?.jobId || "");
    if (!jobId) return res.status(400).json({ ok: false, error: "missing jobId" });

    const job = await getJob(jobId);
    if (job.steps?.sendEmails?.status === "DONE") return res.json({ ok: true, skipped: true });

    try {
      await patchJob(jobId, {
        step: "SEND_EMAILS",
        "steps.sendEmails": { status: "RUNNING", at: Date.now() },
      });

      const body = job.payload as VolunteerOnboardingPayload;
      const createdEmail = String(job.data?.workspaceEmail || "").trim();
      const tempPassword = String(job.data?.tempPassword || "").trim();

      if (!createdEmail) throw new Error("Missing job.data.workspaceEmail");
      if (!tempPassword) throw new Error("Missing job.data.tempPassword");

      const slackInviteLink = process.env.SLACK_INVITE_LINK?.trim() || "";

      // Personal email onboarding
      await sendOnboardingEmail({
        toPersonalEmail: String(body.personalEmail).trim(),
        firstName: String(body.firstName).trim(),
        team: String(body.team).trim(),
        polishYouthEmail: createdEmail,
        tempPassword,
        slackInviteLink,
        htmlTemplate: ONBOARDING_TEMPLATE_HTML
      });

      // PSM inbox onboarding
      await sendOnboardingEmail({
        toPersonalEmail: createdEmail,
        firstName: String(body.firstName).trim(),
        team: String(body.team).trim(),
        polishYouthEmail: createdEmail,
        tempPassword: "—",
        slackInviteLink,
        htmlTemplate: ONBOARDING_TEMPLATE_PSM_HTML
      });

      await patchJob(jobId, {
        step: "TRIGGER_DOCUSIGN",
        "steps.sendEmails": { status: "DONE", at: Date.now() },
      });

      await enqueueTask({
        path: "/tasks/onboarding/trigger-docusign",
        payload: { jobId },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      await patchJob(jobId, {
        status: "FAILED",
        "steps.sendEmails": { status: "FAILED", at: Date.now(), error: e?.message ?? String(e) },
      });
      return res.status(500).json({ ok: false });
    }
  });

  /**
   * STEP 4: Trigger Slack DocuSign workflow
   */
  router.post("/tasks/onboarding/trigger-docusign", async (req, res) => {
    const jobId = String(req.body?.jobId || "");
    if (!jobId) return res.status(400).json({ ok: false, error: "missing jobId" });

    const job = await getJob(jobId);
    if (job.steps?.triggerDocusign?.status === "DONE") return res.json({ ok: true, skipped: true });

    try {
      await patchJob(jobId, {
        step: "TRIGGER_DOCUSIGN",
        "steps.triggerDocusign": { status: "RUNNING", at: Date.now() },
      });

      const body = job.payload as VolunteerOnboardingPayload;

      const email = String(body.personalEmail).trim();
      const name = `${String(body.firstName).trim()} ${String(body.lastName).trim()}`.trim();

      await triggerSlackDocusignWorkflow(email, name);

      await patchJob(jobId, {
        status: "COMPLETED",
        step: "DONE",
        "steps.triggerDocusign": { status: "DONE", at: Date.now() },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      await patchJob(jobId, {
        status: "FAILED",
        "steps.triggerDocusign": { status: "FAILED", at: Date.now(), error: e?.message ?? String(e) },
      });
      return res.status(500).json({ ok: false });
    }
  });
});

listen(app, PORT, () => {
  console.log("🚀 volunteer-onboarding running on port " + PORT);
});