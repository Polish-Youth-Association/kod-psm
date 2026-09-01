/**
 * export-firestore-to-wix.ts
 *
 * READ-ONLY export of the psm-member-platform Firestore DB into CSVs ready for Wix CMS import.
 * Run this while GCP is still up (Phase P1 dry-run and again for the final P3 cutover).
 *
 *   Auth: gcloud auth application-default login   (ADC — same as the services use)
 *   Run:  pnpm ts-node scripts/export-firestore-to-wix.ts   [outDir]
 *
 * Emits into outDir (default ./wix-export):
 *   Members.csv    — import into the Members collection
 *   Counters.csv   — import into the Counters collection (_id = prefix, next)
 *   MemberIds.csv  — import into the MemberIds guard collection (_id = each memberId)
 *
 * Transforms (see plan §7):
 *   - flattens address.{line1,city,state,postalCode,country}
 *   - normalizes status vocab: NEEDS_ONBOARDING->NOT_ONBOARDED, DONE->ONBOARDED
 *   - preserves memberId exactly (no zero-padding, matching the code)
 *   - Counters.next = max(existing next, per-prefix maxSuffix + 1)
 */
import fs from 'node:fs';
import path from 'node:path';
import { initFirestore } from '@kod-psm/gcp-helpers';

const OUT_DIR = path.resolve(process.argv[2] || 'wix-export');

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(file: string, headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  console.log(`wrote ${rows.length} rows -> ${file}`);
}

function normalizeStatus(raw: unknown): string {
  const s = String(raw || '').toUpperCase();
  if (s === 'DONE' || s === 'ONBOARDED') return 'ONBOARDED';
  return 'NOT_ONBOARDED'; // covers NEEDS_ONBOARDING, NOT_ONBOARDED, empty
}

function suffixNumber(memberId: string, prefix: string): number {
  const tail = memberId.startsWith(prefix) ? memberId.slice(prefix.length) : memberId.replace(/^\D+/, '');
  const n = parseInt(tail, 10);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const db = initFirestore({ databaseId: 'psm-member-platform' });

  // --- Members ---
  const membersSnap = await db.collection('members').get();
  const memberRows: Record<string, unknown>[] = [];
  const memberIdRows: Record<string, unknown>[] = [];
  const maxSuffixByPrefix = new Map<string, number>();

  for (const doc of membersSnap.docs) {
    const d = doc.data();
    const address = (d.address as Record<string, unknown>) || {};
    const prefix = String(d.prefix || '');
    const memberId = String(d.memberId || '');

    if (prefix && memberId) {
      const n = suffixNumber(memberId, prefix);
      if (n > (maxSuffixByPrefix.get(prefix) || 0)) maxSuffixByPrefix.set(prefix, n);
    }
    if (memberId) memberIdRows.push({ _id: memberId, prefix, n: suffixNumber(memberId, prefix) });

    memberRows.push({
      // Note: Wix generates its own _id on import; memberId is the durable business key.
      memberId,
      prefix,
      fullName: d.fullName ?? `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim(),
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      firstNamePolish: d.firstNamePolish ?? '',
      email: String(d.email ?? '').trim().toLowerCase(),
      birthday: d.birthday ?? '',
      phone: d.phone ?? '',
      addressLine1: address.line1 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      postalCode: address.postalCode ?? '',
      country: address.country ?? '',
      onboardingStatus: normalizeStatus(d.onboardingStatus),
      certStatus: d.certStatus ?? '',
      certUrl: d.certUrl ?? '',
      certFileId: d.certObjectPath ?? '', // old GCS path; re-pointed to Wix Media on regeneration
      wixContactId: d.wixContactId ?? '',
      wixAttachStatus: d.wixAttachStatus ?? '',
      wixFieldsUpdated: d.wixFieldsUpdated ?? false,
      source: d.source ?? 'wix',
      flow: d.flow ?? '', // unknown for legacy rows; leave blank
      raw: d.raw ?? '',
    });
  }

  const memberHeaders = Object.keys(memberRows[0] || { memberId: '' });
  writeCsv(path.join(OUT_DIR, 'Members.csv'), memberHeaders, memberRows);
  writeCsv(path.join(OUT_DIR, 'MemberIds.csv'), ['_id', 'prefix', 'n'], memberIdRows);

  // --- Counters --- (take max of existing next and computed maxSuffix+1)
  const countersSnap = await db.collection('counters').get();
  const seen = new Set<string>();
  const counterRows: Record<string, unknown>[] = [];
  for (const doc of countersSnap.docs) {
    const prefix = doc.id;
    const existingNext = Number(doc.data().next) || 1;
    const safeNext = Math.max(existingNext, (maxSuffixByPrefix.get(prefix) || 0) + 1);
    counterRows.push({ _id: prefix, next: safeNext });
    seen.add(prefix);
  }
  // Include prefixes that appear in members but have no counter doc yet.
  for (const [prefix, maxSuffix] of maxSuffixByPrefix) {
    if (!seen.has(prefix)) counterRows.push({ _id: prefix, next: maxSuffix + 1 });
  }
  writeCsv(path.join(OUT_DIR, 'Counters.csv'), ['_id', 'next'], counterRows);

  console.log('\nDone. Verify row counts, then import each CSV into its Wix collection.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
