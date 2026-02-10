import { google } from "googleapis";
import { getDelegatedAccessToken } from "./workspaceAuth";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const CC_EMAIL = "onboarding@polishyouth.org";

function base64url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function renderTemplate(html: string, vars: Record<string, string>) {
  return html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m, key) => vars[key] ?? "");
}

export async function sendOnboardingEmail(args: {
  toPersonalEmail: string;
  firstName: string;
  team: string;
  polishYouthEmail: string;
  tempPassword: string;
  htmlTemplate: string;
  subject?: string;
  cc?: string | string[];
  slackInviteLink?: string;
}) {
  const from = process.env.ONBOARDING_FROM_EMAIL?.trim();
  if (!from) throw new Error("ONBOARDING_FROM_EMAIL is not set");

  const accessToken = await getDelegatedAccessToken([GMAIL_SEND_SCOPE]);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  const subject =
    args.subject?.trim() || `Welcome to the Polish Youth Association <${args.team}> Team`;

  const html = renderTemplate(args.htmlTemplate, {
    FIRST_NAME: args.firstName,
    TEAM: args.team,
    POLISH_YOUTH_EMAIL: args.polishYouthEmail,
    TEMP_PASSWORD: args.tempPassword
  });

  // RFC 5322 raw message (HTML)
  const raw = [
    `From: "Polish Youth Association" <${from}>`,
    `To: ${args.toPersonalEmail}`,
    `Cc: ${CC_EMAIL}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    html
  ].join("\r\n");

  await gmail.users.messages.send({
    userId: from, // send as this mailbox
    requestBody: { raw: base64url(raw) }
  });
}