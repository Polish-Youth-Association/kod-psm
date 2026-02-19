import { google } from "googleapis";
import { getDelegatedAccessToken } from "./workspaceAuth";

const GMAIL_SETTINGS_SCOPE = "https://www.googleapis.com/auth/gmail.settings.basic";

const DEFAULTS = {
  bannerUrl: process.env.SIGNATURE_BANNER_URL?.trim() ||
    "https://static.wixstatic.com/media/d7f1c6_4692e1506cb8406798ac7defaf85bed1~mv2.png",
  instagramUrl: process.env.SIGNATURE_INSTAGRAM_URL?.trim() ||
    "https://instagram.com/polishyouthassn",
  facebookUrl: process.env.SIGNATURE_FACEBOOK_URL?.trim() ||
    "https://facebook.com/polishyouthassn",
  linkedinUrl: process.env.SIGNATURE_LINKEDIN_URL?.trim() ||
    "https://linkedin.com/company/polishyouthassn",
};

function esc(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPolishYouthSignatureHtml(args: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.35; color: #111;">
  <div style="font-weight:700; font-size:14px;">
    ${esc(args.firstName)} ${esc(args.lastName)}
  </div>

  <div style="margin:10px 0;">
    <img src="${esc(DEFAULTS.bannerUrl)}" alt="Polish Youth"
      style="max-width:360px; width:100%; height:auto; border:0; display:block;" />
  </div>

  <div style="margin-top:6px;">
    <div>e. <a href="mailto:${esc(args.email)}" style="color:#111; text-decoration:none;">${esc(args.email)}</a></div>
    <div>w. <a href="https://polishyouth.org" style="color:#111; text-decoration:none;">polishyouth.org</a></div>
  </div>

  <div style="margin-top:8px;">
    <a href="${esc(DEFAULTS.instagramUrl)}" style="color:#111; text-decoration:none;">instagram</a>
    <span style="color:#999;"> | </span>
    <a href="${esc(DEFAULTS.facebookUrl)}" style="color:#111; text-decoration:none;">facebook</a>
    <span style="color:#999;"> | </span>
    <a href="${esc(DEFAULTS.linkedinUrl)}" style="color:#111; text-decoration:none;">linkedin</a>
  </div>

  <!-- managed:polishyouth -->
</div>`.trim();
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function setGmailSignatureForUser(args: {
  userEmail: string;       // mailbox to update
  signatureHtml: string;
  retries?: number;        // default 6
}) {
  const retries = args.retries ?? 6;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // IMPORTANT: impersonate the target mailbox
      const accessToken = await getDelegatedAccessToken([GMAIL_SETTINGS_SCOPE], args.userEmail);

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: "v1", auth });

      // Safer than assuming sendAsEmail === primary (aliases exist)
      const sendAs = await gmail.users.settings.sendAs.list({ userId: "me" });
      const primary = (sendAs.data.sendAs || []).find((s) => s.isPrimary);
      const sendAsEmail = primary?.sendAsEmail || args.userEmail;

      await gmail.users.settings.sendAs.update({
        userId: "me",
        sendAsEmail,
        requestBody: { signature: args.signatureHtml },
      });

      return;
    } catch (e: any) {
      const msg = e?.message ?? String(e);

      if (attempt < retries) {
        const backoffMs = Math.min(30_000, 1_000 * 2 ** attempt);
        console.warn(`[signature] attempt ${attempt + 1} failed for ${args.userEmail}: ${msg}`);
        await sleep(backoffMs);
        continue;
      }

      throw new Error(`[signature] failed for ${args.userEmail}: ${msg}`);
    }
  }
}