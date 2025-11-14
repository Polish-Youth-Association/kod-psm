import express, { Request, Response } from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import cors from 'cors';
import { renderNewMemberEmail } from '@kod-psm/email-templates';

// ------------------------------
// ENV VALIDATION
// ------------------------------
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USERNAME,
  SMTP_PASSWORD,
  EMAIL_SENDER,
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USERNAME || !SMTP_PASSWORD || !EMAIL_SENDER) {
  console.error('❌ Missing required SMTP environment variables.');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: {
    user: SMTP_USERNAME,
    pass: SMTP_PASSWORD,
  },
});

/**
 * Health check for Cloud Run
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'new-member-onboarding-app' });
});

/**
 * POST /onboard
 *
 * Accepts:
 * - firstNamePolish
 * - firstNameEnglish
 * - email
 * - memberId
 * - certificate (PDF file)
 */
app.post(
  '/onboard',
  upload.single('certificate'),
  async (req: Request, res: Response) => {
    try {
      const {
        firstNamePolish,
        firstNameEnglish,
        email,
        memberId,
      } = req.body;

      if (!firstNamePolish || !firstNameEnglish || !email || !memberId) {
        return res.status(400).json({
          error: 'Missing required fields.',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'Certificate PDF file is required.',
        });
      }

      const html = renderNewMemberEmail({
        firstNamePolish,
        firstNameEnglish,
        memberId,
      });

      await transporter.sendMail({
        from: EMAIL_SENDER,
        to: email,
        subject: 'Welcome to Polish Youth Association!',
        html,
        attachments: [
          {
            filename: `Member_Certificate_${memberId}.pdf`,
            content: req.file.buffer,
            contentType: 'application/pdf',
          },
        ],
      });

      return res.json({ ok: true, message: 'Onboarding email sent.' });
    } catch (err) {
      console.error('❌ Error in /onboard:', err);

      // During local dev, expose the message so we can debug
      const message =
        err instanceof Error ? err.message : 'Internal server error.';

      return res.status(500).json({
        error:
          process.env.NODE_ENV === 'production'
            ? 'Internal server error.'
            : message,
      });
    }
  }
);
// ------------------------------
// START SERVER
// ------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 new-member-onboarding-app running on port ${PORT}`);
});