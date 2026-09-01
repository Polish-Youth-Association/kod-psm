// backend/cert.js
// Port of apps/certificate-generator (pdf-lib render). Runs server-side in Velo (pure JS),
// uploads the PDF to Wix Media, and returns the media URL + id.
//
// The template PDF and bold font are fetched once from Wix Media and cached in module scope.
// Upload apps/certificate-generator/templates/CertTemplate.pdf and
// templates/fonts/WixMadeforText-Bold.ttf to your Wix Media, then set the two URLs below
// (or store them as secrets/config). Install `pdf-lib` + `@pdf-lib/fontkit` in the Velo Package Manager.

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { fetch } from 'wix-fetch';
import { mediaManager } from 'wix-media-backend';

// TODO: set these to the Wix Media URLs of the uploaded template + font.
const TEMPLATE_URL = ''; // e.g. 'https://static.wixstatic.com/.../CertTemplate.pdf'
const FONT_URL = ''; //     e.g. 'https://static.wixstatic.com/.../WixMadeforText-Bold.ttf'

let templateBytes = null;
let fontBytes = null;

async function loadAsset(url, current) {
  if (current) return current;
  if (!url) throw new Error('cert asset URL not configured (see backend/cert.js)');
  const resp = await fetch(url, { method: 'get' });
  if (!resp.ok) throw new Error(`failed to load cert asset ${url}: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Render a certificate PDF for a member and store it in Wix Media.
 * Placement matches the old certificate-generator exactly (name centered at y=height-285,
 * memberId at x=120,y=height-525).
 * @returns {Promise<{ ok: boolean, certificateId: string, url: string, fileId: string, bytes: Uint8Array }>}
 */
export async function generateAndStore(memberId, firstName, lastName) {
  templateBytes = await loadAsset(TEMPLATE_URL, templateBytes);
  fontBytes = await loadAsset(FONT_URL, fontBytes);

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const boldFont = await pdfDoc.embedFont(fontBytes);

  const [page] = pdfDoc.getPages();
  const { width, height } = page.getSize();

  const fullName = `${firstName} ${lastName}`;
  const fontSizeName = 30;
  const textWidth = boldFont.widthOfTextAtSize(fullName, fontSizeName);
  page.drawText(fullName, {
    x: (width - textWidth) / 2,
    y: height - 285,
    size: fontSizeName,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  page.drawText(memberId, {
    x: 120,
    y: height - 525,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  const bytes = await pdfDoc.save();
  const certificateId = String(memberId).toUpperCase();

  // Upload to Wix Media (replaces GCS certificates/{id}.pdf).
  const uploaded = await mediaManager.upload(
    '/certificates',
    Buffer.from(bytes),
    `${certificateId}.pdf`,
    {
      mediaOptions: { mimeType: 'application/pdf', mediaType: 'document' },
      metadataOptions: { isPrivate: false, isVisitorUpload: false },
    }
  );

  const url = uploaded.fileUrl || uploaded.fileName || '';
  const fileId = uploaded.fileName || uploaded.fileUrl || '';
  return { ok: true, certificateId, url, fileId, bytes };
}
