// backend/events.js
// Wires Wix Form submissions to the ingestion handlers. This replaces the inbound Wix webhooks
// that used to hit persist-member /wix/signup and member-onboarding /api/intake.
//
// Wix Forms fire the backend event `wixForms_onFormSubmit` (Wix Forms) or `wixFormsV2_onFormSubmit`
// (Forms V2) — confirm which your site uses. Because form field names + form IDs are site-specific,
// the mapping below is marked TODO: fill in your actual form IDs and field keys from the Wix editor.
//
// Alternative: use a Wix Automation ("Form submitted" -> "Run Velo code") calling intake()/signup().

import { intake } from 'backend/intake';
import { signup } from 'backend/signup';

// TODO: set these to your real Wix form IDs (from the form settings in the editor).
const INTAKE_FORM_ID = 'REPLACE_WITH_INTAKE_FORM_ID';
const SIGNUP_FORM_ID = 'REPLACE_WITH_SIGNUP_FORM_ID';

/**
 * @param {import('wix-crm-backend').FormSubmitEvent} event
 */
export async function wixForms_onFormSubmit(event) {
  const formId = event.formId || (event.form && event.form.id);
  const fields = flattenSubmission(event);
  const contactId = event.contactId || (event.contact && event.contact._id) || null;

  try {
    if (formId === INTAKE_FORM_ID) {
      await intake({
        fullName: fields.fullName,
        email: fields.email,
        birthday: fields.birthday,
        phone: fields.phone,
        contactId,
        address: {
          line1: fields.addressLine1,
          city: fields.city,
          state: fields.state,
          postalCode: fields.postalCode,
          country: fields.country,
        },
      });
    } else if (formId === SIGNUP_FORM_ID) {
      await signup({
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        phone: fields.phone,
        location: fields.location,
        contactId,
        raw: fields,
      });
    }
  } catch (err) {
    // Log and swallow — a thrown error in an event handler is not surfaced to the submitter.
    console.error('form submit ingestion failed', { formId, error: err && err.message });
  }
}

// TODO: map Wix submission fields to our shape. `event.submissions` is typically an array of
// { label, value } or a keyed object depending on Forms version — inspect a real event and adjust.
function flattenSubmission(event) {
  const out = {};
  const subs = event.submissions || event.contactFormFields || [];
  if (Array.isArray(subs)) {
    for (const s of subs) {
      if (s && s.label) out[s.label] = s.value;
    }
  } else if (subs && typeof subs === 'object') {
    Object.assign(out, subs);
  }
  return out;
}
