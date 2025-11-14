"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNewMemberEmail = buildNewMemberEmail;
const email_templates_1 = require("@kod-psm/email-templates");
/**
 * For now this just returns the HTML + metadata.
 * Later we’ll plug in a mail transport (Gmail, SMTP, etc.).
 */
function buildNewMemberEmail(payload) {
    const { to, subject, ...templateData } = payload;
    const html = (0, email_templates_1.renderNewMemberEmailHtml)(templateData);
    return {
        to,
        subject: subject ?? 'Welcome to PSM / Witamy w PSM',
        html,
    };
}
