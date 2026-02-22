const twilio = require("twilio");

// Only build a real Twilio client when all required env vars are present.
// Missing config -> dev mode: SMS messages are printed to the console instead of sent.
const hasTwilioConfig = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
);

const client = hasTwilioConfig
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

async function sendSms({ to, body }) {
    if (!to) return { skipped: true, reason: "NO_PHONE" };

    if (!client) {
        console.log(`[sms:dev] to=${to}\n${body}`);
        return { dev: true };
    }

    return client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body });
}

module.exports = { sendSms };
