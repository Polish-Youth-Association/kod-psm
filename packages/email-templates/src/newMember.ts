import fs from 'fs';
import path from 'path';

export type NewMemberTemplateParams = {
  firstNamePolish: string;
  firstNameEnglish: string;
  memberId: string;
};

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'NewMembersEmailTemplate.html');

let cachedTemplate: string | null = null;

function loadTemplate(): string {
  if (cachedTemplate) return cachedTemplate;

  try {
    cachedTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  } catch (err) {
    console.error('Failed to load NewMembersEmailTemplate.html at', TEMPLATE_PATH, err);
    cachedTemplate = '<p>New member email template missing.</p>';
  }

  return cachedTemplate;
}

export function renderNewMemberEmail(params: NewMemberTemplateParams): string {
  let html = loadTemplate();

  // IMPORTANT: make sure these match your actual placeholders
  html = html.replace(/{{FirstNamePolish}}/g, params.firstNamePolish);
  html = html.replace(/{{FirstNameEnglish}}/g, params.firstNameEnglish);
  html = html.replace(/{{MemberID}}/g, params.memberId);

  return html;
}

/**
 * Backwards-compat layer for email-service
 * ---------------------------------------
 * Older code expects:
 *   - type NewMemberEmailData { firstNamePl, firstNameEn, memberId }
 *   - function renderNewMemberEmailHtml(data: NewMemberEmailData): string
 */

export type NewMemberEmailData = {
  firstNamePl: string;
  firstNameEn: string;
  memberId: string;
};

export function renderNewMemberEmailHtml(data: NewMemberEmailData): string {
  return renderNewMemberEmail({
    firstNamePolish: data.firstNamePl,
    firstNameEnglish: data.firstNameEn,
    memberId: data.memberId,
  });
}