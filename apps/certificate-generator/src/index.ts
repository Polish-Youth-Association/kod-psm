import express from 'express';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'node:fs/promises';
import fontkit from '@pdf-lib/fontkit';
import path from 'node:path';
import { initStorage } from '@kod-psm/gcp-helpers';
import { uploadCertificateToDrive } from './driveUpload';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8080;

const CERT_TEMPLATE_PATH = path.resolve(
  __dirname,
  '../templates/CertTemplate.pdf'
);

const LOCAL_OUTPUT_DIR = path.resolve(
  __dirname,
  '../generated_files',
);

const storage = initStorage({
  bucketName: process.env.GCP_BUCKET_NAME,
  projectId: process.env.GCP_PROJECT_ID,
  localBaseDir: LOCAL_OUTPUT_DIR,
});

async function ensureGeneratedDir() {
  await fs.mkdir(LOCAL_OUTPUT_DIR, { recursive: true });
}

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'certificate-generator',
  });
});

app.post('/generate-certificate', async (req, res) => {
  try {
    const { memberId, firstName, lastName } = req.body;

    // Validate input
    if (!memberId || !firstName || !lastName) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: memberId, firstName, lastName',
      });
    }
    await ensureGeneratedDir();

    const templateBytes = await fs.readFile(CERT_TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);

    const [page] = pdfDoc.getPages();
    const { width, height } = page.getSize();
    
    const customBoldFontBytes = await fs.readFile(
      path.resolve(__dirname, '../templates/fonts/WixMadeforText-Bold.ttf')
    );

    pdfDoc.registerFontkit(fontkit);
    const boldFont = await pdfDoc.embedFont(customBoldFontBytes);

    const fullName = `${firstName} ${lastName}`;
    const fontSizeName = 30
    const textWidth = boldFont.widthOfTextAtSize(fullName, fontSizeName);
    const centeredX = (width - textWidth) / 2;
    
    page.drawText(fullName, {
      x: centeredX,
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

    const pdfBytes = await pdfDoc.save();

    const certificateId = `${memberId}`.toUpperCase();
    const objectPath = `certificates/${certificateId}.pdf`;

    const result = await storage.saveFile(
      pdfBytes,
      objectPath,
      'application/pdf',
      {
        memberId,
        firstName,
        lastName,
        generatedAt: new Date().toISOString(),
      },
      { public: true },
    );

    // Upload to Google Drive (best-effort — does not block or fail the response)
    let driveFileId: string | undefined;
    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      try {
        driveFileId = await uploadCertificateToDrive(
          pdfBytes,
          `${certificateId}.pdf`,
        );
        console.log(`Drive upload success for ${certificateId}: ${driveFileId}`);
      } catch (driveErr) {
        console.warn(`Drive upload failed for ${certificateId}:`, driveErr);
      }
    }

    return res.json({
      ok: true,
      message:
        result.backend === 'gcs'
          ? 'Certificate generated and stored in Cloud Storage'
          : 'Certificate generated and stored locally',
      certificateId,
      driveFileId,
      ...result,
    });
  } catch (err) {
    console.error('Error generating certificate:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

app.listen(PORT, () => {
  console.log(
    '🚀 Certificate-Generator (certificate-generator) running on port ' +
      PORT,
  );
});
