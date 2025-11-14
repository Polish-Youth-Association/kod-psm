import { buildNewMemberEmail } from './newMemberEmail';
import * as fs from 'node:fs';
import * as path from 'node:path';

function main() {
  const email = buildNewMemberEmail({
    to: 'test@example.org',
    firstNamePl: 'Michał',
    firstNameEn: 'Michael',
    memberId: 'PSM-12345',
  });

  const outPath = path.join(__dirname, '..', 'new-member-preview.html');
  fs.writeFileSync(outPath, email.html, 'utf8');

  console.log('Preview written to:', outPath);
}

main();
