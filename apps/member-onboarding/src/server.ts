// src/server.ts
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
} = process.env;

const hasSmtpConfig =
  Boolean(SMTP_HOST) &&
  Boolean(SMTP_PORT) &&
  Boolean(SMTP_USER) &&
  Boolean(SMTP_PASS) &&
  Boolean(EMAIL_FROM);

if (!hasSmtpConfig) {
  console.warn(
    '⚠️ SMTP env vars are not fully set. /api/onboard will return 500 when called.',
  );
}

let emailTemplate: string | null = null;

function loadNewMemberTemplate(): string | null {
  if (emailTemplate) return emailTemplate;

  const templatePath = path.resolve(
    __dirname,
    '../templates/NewMembersEmailTemplate.html',
  );

  try {
    emailTemplate = fs.readFileSync(templatePath, 'utf8');
    console.log('✅ Loaded NewMembersEmailTemplate.html from', templatePath);
  } catch (err) {
    console.error('❌ Failed to load email template from', templatePath, err);
    console.warn('⚠️ Could not load email template. Falling back to inline HTML.');
    emailTemplate = null;
  }

  return emailTemplate;
}

function renderNewMemberEmail(params: {
  firstNamePolish: string;
  firstNameEnglish: string;
  memberId: string;
}) {
  const base = loadNewMemberTemplate();

  if (!base) {
    return `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
        <h2>Welcome to Polish Youth Association!</h2>
        <p>Dear ${params.firstNamePolish} (${params.firstNameEnglish}),</p>
        <p>Your membership ID is <strong>${params.memberId}</strong>.</p>
        <p>Serdecznie pozdrawiamy,<br/>Polish Youth Association</p>
      </div>
    `;
  }

  return base
    .replace(/{{\s*firstNamePolish\s*}}/gi, params.firstNamePolish)
    .replace(/{{\s*firstNameEnglish\s*}}/gi, params.firstNameEnglish)
    .replace(/{{\s*memberId\s*}}/gi, params.memberId)

    .replace(/\[First Name Polish\]/g, params.firstNamePolish)
    .replace(/\[First Name English\]/g, params.firstNameEnglish)
    .replace(/\[MEMBERSHIP_ID\]/g, params.memberId);
}

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'member-onboarding-app' });
});

app.post(
  '/api/onboard',
  upload.single('certificate'),
  async (req: Request, res: Response) => {
    try {
      if (!hasSmtpConfig || !transporter) {
        return res
          .status(500)
          .json({ error: 'Email transport not configured on server.' });
      }

      const {
        firstNamePolish,
        firstNameEnglish,
        email,
        memberId,
      } = req.body as Record<string, string>;

      if (!firstNamePolish || !firstNameEnglish || !email || !memberId) {
        return res.status(400).json({
          error:
            'Missing required fields. firstNamePolish, firstNameEnglish, email, memberId are required.',
        });
      }

      const certFile = req.file || null;

      const htmlBody = renderNewMemberEmail({
        firstNamePolish,
        firstNameEnglish,
        memberId,
      });

      const attachments = certFile
        ? [
            {
              filename:
                certFile.originalname ||
                `Member_Certificate_${memberId}.pdf`,
              content: certFile.buffer,
              contentType:
                certFile.mimetype || 'application/pdf',
            },
          ]
        : [];

      const mailOptions = {
        // You can use SMTP_USER or EMAIL_FROM here depending on how Gmail is configured
        from: `"PSM Onboarding" <${EMAIL_FROM || SMTP_USER}>`,
        to: email, // send to the new member
        subject: `Welcome to Polish Youth Association! (ID: ${memberId})`,
        html: htmlBody,
        attachments,
      };

      await transporter.sendMail(mailOptions);

      console.log('✅ Onboarding email sent for member:', memberId);

      return res.json({ ok: true, message: 'Onboarding email sent.' });
    } catch (err) {
      console.error('❌ Error in /api/onboard:', err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  },
);

const clientDistPath = path.join(__dirname, 'client');

app.use(express.static(clientDistPath));

app.get('*', (_req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(500).send('Client build not found');
  }
  res.sendFile(indexPath);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 member-onboarding app listening on port ${PORT}`);
});