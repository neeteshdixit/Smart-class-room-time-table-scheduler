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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
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

  if (!fromAddress) {
    throw buildMailerError("SMTP sender email is missing. Set SMTP_FROM (or SMTP_USER) in .env.");
  }

  if (!isValidEmail(fromAddress)) {
    throw buildMailerError("SMTP sender email is invalid. Check SMTP_FROM/SMTP_USER in .env.");
  }

  if (!toEmail) {
    throw buildMailerError("Recipient email is missing for this account. Please update account email and retry.");
  }

  if (!isValidEmail(toEmail)) {
    throw buildMailerError("Recipient email is invalid for this account. Please update account email and retry.");
  }

  try {
    await getTransporter().sendMail({
      from: fromAddress,
      to: toEmail,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otpCode}\nThis OTP is valid for 5 minutes.`,
    });
  } catch (err) {
    const smtpMessage = String(err?.message || "");

    if (/invalid login|badcredentials|username and password not accepted/i.test(smtpMessage)) {
      throw buildMailerError(
        "SMTP authentication failed. Update SMTP_USER and SMTP_PASS in .env (use a valid Gmail App Password)."
      );
    }

    if (/econnection|etimedout|enotfound|eai_again|socket/i.test(smtpMessage)) {
      throw buildMailerError(
        "SMTP connection failed. Check SMTP_HOST/SMTP_PORT and internet access, then retry."
      );
    }

    throw buildMailerError("Failed to send OTP email. Verify SMTP configuration and try again.");
  }
}

module.exports = {
  sendPasswordResetOtpEmail,
};
