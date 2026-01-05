import { createApp, listen } from '@kod-psm/http-helpers';
import admin from 'firebase-admin';
import { z } from 'zod';

const PORT = Number(process.env.PORT) || 8080;

// Secret used to authenticate Wix -> your service
const WIX_WEBHOOK_SECRET = process.env.WIX_WEBHOOK_SECRET ?? '';

// Firebase Admin (Cloud Run: use attached service account / ADC)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ---- Helpers ----

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// TODO: replace with your real mapping
function prefixFromLocation(locationRaw: string): string {
  const loc = (locationRaw || '').trim().toLowerCase();
  if (loc.includes('new york') || loc === 'ny') return 'DNY';
  if (loc.includes('new jersey') || loc === 'nj') return 'DNJ';
  if (loc.includes('pennsylvania') || loc === 'pa') return 'DPA';
  return 'DXX';
}

// Accept a flexible payload because Wix can send different shapes depending on how you wire it.
// If you already know the exact field names coming from Wix, tighten this schema.
const WixSignupSchema = z.object({
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  location: z.string().optional().default(''),
  // ideal if Wix gives you a stable id; otherwise we'll auto-id
  wixSubmissionId: z.string().optional().default(''),
});

const app = createApp((router) => {
  // health / info
  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'persist-member',
    });
  });

  // ingest new member (called by Wix automation/webhook)
  router.post('/wix/signup', async (req, res) => {
    try {
      // 1) auth
      const secret =
        (req.headers['x-wix-secret'] as string | undefined) ??
        (req.headers['X-Wix-Secret'] as string | undefined) ??
        '';

      if (!WIX_WEBHOOK_SECRET || secret !== WIX_WEBHOOK_SECRET) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }

      // 2) validate
      const parsed = WixSignupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: 'invalid_payload',
          details: parsed.error.flatten(),
        });
      }

      const input = parsed.data;
      const email = normalizeEmail(input.email);
      const prefix = prefixFromLocation(input.location);

      // 3) refs
      const membersCol = db.collection('members');
      const memberRef = input.wixSubmissionId ? membersCol.doc(input.wixSubmissionId) : membersCol.doc();
      const counterRef = db.collection('counters').doc(prefix);

      // 4) transaction: idempotent + atomic increment
      const result = await db.runTransaction(async (tx) => {
        const existingMember = await tx.get(memberRef);
        if (existingMember.exists) {
          return {
            docId: memberRef.id,
            memberId: existingMember.get('memberId') as string,
            alreadyExisted: true,
          };
        }

        const counterSnap = await tx.get(counterRef);

        // IMPORTANT:
        // For now, default starts at 1.
        // After CSV migration, you'll set counters/{prefix}.next to (maxSuffix + 1).
        const currentNext = counterSnap.exists ? (counterSnap.get('next') as number) : 1;

        const assignedNumber = currentNext;
        const nextNumber = currentNext + 1;
        const memberId = `${prefix}${assignedNumber}`;

        tx.set(
          memberRef,
          {
            memberId,
            prefix,
            location: input.location,
            email,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,

            // onboarding controls
            needsOnboarding: true,
            onboardingStatus: 'NEEDS_ONBOARDING',

            source: 'wix',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),

            // keep original payload early on; you can drop later if you want
            raw: req.body,
          },
          { merge: true }
        );

        tx.set(
          counterRef,
          {
            next: nextNumber,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { docId: memberRef.id, memberId, alreadyExisted: false };
      });

      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  // optional: mark onboarding done (for your internal tooling later)
  router.post('/members/:docId/onboarding/done', async (req, res) => {
    try {
      const docId = req.params.docId;
      await db.collection('members').doc(docId).set(
        {
          needsOnboarding: false,
          onboardingStatus: 'DONE',
          onboardedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });
});

listen(app, PORT, () => {
  console.log('🚀 persist-member running on port ' + PORT);
});