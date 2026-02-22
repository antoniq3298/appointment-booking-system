const nodemailer = require("nodemailer");

// Only build a real SMTP transporter when all required env vars are present.
// Missing config -> dev mode: emails are printed to the console instead of sent.
const hasSmtpConfig = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = hasSmtpConfig
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
    : null;

async function sendEmail({ to, subject, text }) {
    if (!transporter) {
        console.log(`[mailer:dev] to=${to} subject="${subject}"\n${text}`);
        return { dev: true };
    }

    return transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text
    });
}

module.exports = { sendEmail };
