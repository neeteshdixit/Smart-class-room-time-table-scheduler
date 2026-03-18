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

function getSmtpTimeoutMs() {
  const value = Number.parseInt(process.env.SMTP_TIMEOUT_MS, 10);
  return Number.isInteger(value) && value > 0 ? value : 15000;
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
  const rawPass = String(process.env.SMTP_PASS || "").trim();
  const pass = /gmail\.com$/i.test(host) ? rawPass.replace(/\s+/g, "") : rawPass;
  const secure = parseBoolean(process.env.SMTP_SECURE);
  const timeoutMs = getSmtpTimeoutMs();

  if (!host || !Number.isInteger(port) || port <= 0 || !user || !pass) {
    throw buildMailerError("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
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
    const timeoutMs = getSmtpTimeoutMs();
    const sendMailPromise = getTransporter().sendMail({
      from: fromAddress,
      to: toEmail,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otpCode}\nThis OTP is valid for 5 minutes.`,
    });
    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const timeoutErr = new Error(`SMTP request timed out after ${timeoutMs}ms`);
        timeoutErr.code = "SMTP_TIMEOUT";
        reject(timeoutErr);
      }, timeoutMs + 1000);
      sendMailPromise.finally(() => clearTimeout(timer));
    });

    await Promise.race([sendMailPromise, timeoutPromise]);
  } catch (err) {
    const smtpMessage = String(err?.message || "");
    const smtpCode = String(err?.code || "");

    if (/invalid login|badcredentials|username and password not accepted/i.test(smtpMessage)) {
      throw buildMailerError(
        "SMTP authentication failed. Update SMTP_USER and SMTP_PASS in .env (use a valid Gmail App Password)."
      );
    }

    if (
      smtpCode === "SMTP_TIMEOUT" ||
      /econnection|etimedout|enotfound|eai_again|socket|econnrefused|timed out/i.test(smtpMessage)
    ) {
      throw buildMailerError(
        "SMTP connection failed or timed out. Check outbound SMTP access (port 587/465), SMTP_HOST/SMTP_PORT, and firewall/network rules."
      );
    }

    throw buildMailerError("Failed to send OTP email. Verify SMTP configuration and try again.");
  }
}

module.exports = {
  sendPasswordResetOtpEmail,
};
