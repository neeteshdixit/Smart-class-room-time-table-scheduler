let transporter = null;

function buildMailerError(message) {
  const err = new Error(message);
  err.statusCode = 500;
  return err;
}

function parseBoolean(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "true";
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (err) {
    throw buildMailerError("Email service dependency missing. Install nodemailer and restart the server.");
  }

  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const secure = parseBoolean(process.env.SMTP_SECURE);

  if (!host || !Number.isInteger(port) || port <= 0 || !user || !pass) {
    throw buildMailerError("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

async function sendPasswordResetOtpEmail(email, otpCode) {
  const toEmail = String(email || "").trim().toLowerCase();
  const fromAddress = String(process.env.SMTP_FROM || process.env.SMTP_USER || "")
    .trim()
    .toLowerCase();

  if (!toEmail || !fromAddress) {
    throw buildMailerError("SMTP sender/recipient email is missing.");
  }

  await getTransporter().sendMail({
    from: fromAddress,
    to: toEmail,
    subject: "Password Reset OTP",
    text: `Your OTP for password reset is: ${otpCode}\nThis OTP is valid for 5 minutes.`,
  });
}

module.exports = {
  sendPasswordResetOtpEmail,
};
