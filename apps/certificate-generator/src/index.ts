import express from 'express';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const BUCKET_NAME = process.env.GCP_BUCKET_NAME || 'certificates';
const PROJECT_ID = process.env.GCP_PROJECT_ID || '';

// Initialize GCP Storage
const storage = new Storage({
  projectId: PROJECT_ID,
});

const bucket = storage.bucket(BUCKET_NAME);

// Path to your template inside the container
const CERT_TEMPLATE_PATH = path.resolve(
  __dirname,
  '../templates/Cert Template.pdf'
);

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

    // 1) Load template PDF from disk
    const templateBytes = await fs.readFile(CERT_TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // 2) Prepare fonts and page
    const [page] = pdfDoc.getPages();
    const { width, height } = page.getSize();

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const fullName = `${firstName} ${lastName}`;

    // 3) Draw text on top of the template
    // NOTE: coordinates are examples; you’ll likely tweak them until they line
    // up perfectly with your placeholders.
    // Origin is bottom-left.
    page.drawText(fullName, {
      x: 200,             // adjust to land on the name line
      y: height - 340,    // tweak until it overlays correctly
      size: 32,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(memberId, {
      x: 260,             // adjust horizontally for membership ID spot
      y: height - 535,    // adjust vertically
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // If you want to **hide** the literal {{…}} text in the template, you can
    // draw a white rectangle over that area *before* drawing the text:
    //
    // page.drawRectangle({
    //   x: 180,
    //   y: height - 370,
    //   width: 500,
    //   height: 60,
    //   color: rgb(1, 1, 1),
    // });

    // 4) Finalize PDF to bytes
    const pdfBytes = await pdfDoc.save();

    // 5) Save to GCS
    const certificateId = uuidv4();
    const fileName = `certificates/${certificateId}.pdf`;
    const file = bucket.file(fileName);

    await file.save(pdfBytes, {
      contentType: 'application/pdf',
      metadata: {
        metadata: {
          memberId,
          firstName,
          lastName,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    // 6) Respond
    return res.json({
      ok: true,
      message: 'Certificate generated successfully',
      certificateId,
      fileName,
      downloadUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`,
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
    '🚀 Certificate-Generator (certificate-generator) running on port ' + PORT
  );
});