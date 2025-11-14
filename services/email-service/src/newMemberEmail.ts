import {
    NewMemberEmailData,
    renderNewMemberEmailHtml,
} from '@kod-psm/email-templates';
  
export interface NewMemberEmailPayload extends NewMemberEmailData {
    to: string;
    subject?: string;
}

/**
 * For now this just returns the HTML + metadata.
 * Later we’ll plug in a mail transport (Gmail, SMTP, etc.).
 */
export function buildNewMemberEmail(
    payload: NewMemberEmailPayload,
    ): { to: string; subject: string; html: string } {
    const { to, subject, ...templateData } = payload;

    const html = renderNewMemberEmailHtml(templateData);
    return {
        to,
        subject: subject ?? 'Welcome to PSM / Witamy w PSM',
        html,
    };
}
