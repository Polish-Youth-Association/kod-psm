// src/server.ts
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import nodemailer from 'nodemailer';

type SmtpConfig = {
  SMTP_HOST: string;
  SMTP_PORT: string | number;
  SMTP_USER: string;
  SMTP_PASS: string;
  EMAIL_FROM: string;
};

function loadSmtpConfig(): SmtpConfig | null {
  const raw = process.env.APP_CONFIG_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SmtpConfig>;

      const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        EMAIL_FROM,
      } = parsed;

      if (
        !SMTP_HOST ||
        !SMTP_PORT ||
        !SMTP_USER ||
        !SMTP_PASS ||
        !EMAIL_FROM
      ) {
        console.warn('APP_CONFIG_JSON is missing one or more SMTP_* fields');
      } else {
        return {
          SMTP_HOST,
          SMTP_PORT,
          SMTP_USER,
          SMTP_PASS,
          EMAIL_FROM,
        };
      }
    } catch (err) {
      console.error('Failed to parse APP_CONFIG_JSON:', err);
    }
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_FROM,
  } = process.env;

  if (
    !SMTP_HOST ||
    !SMTP_PORT ||
    !SMTP_USER ||
    !SMTP_PASS ||
    !EMAIL_FROM
  ) {
    console.warn(
      'SMTP env vars are not fully set. /api/onboard will return 500 when called.',
    );
    return null;
  }

  return {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_FROM,
  };
}

const smtpConfig = loadSmtpConfig();
const hasSmtpConfig = Boolean(smtpConfig);

const transporter = smtpConfig
  ? nodemailer.createTransport({
      host: smtpConfig.SMTP_HOST,
      port: Number(smtpConfig.SMTP_PORT),
      secure: Number(smtpConfig.SMTP_PORT) === 465,
      auth: {
        user: smtpConfig.SMTP_USER,
        pass: smtpConfig.SMTP_PASS,
      },
    })
  : null;

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

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

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