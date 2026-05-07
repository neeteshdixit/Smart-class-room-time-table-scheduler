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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getFromAddress() {
  const fromAddress = normalizeEmail(process.env.SMTP_FROM || process.env.SMTP_USER || "");
  if (!fromAddress) {
    throw buildMailerError("SMTP sender email is missing. Set SMTP_FROM (or SMTP_USER) in .env.");
  }
  if (!isValidEmail(fromAddress)) {
    throw buildMailerError("SMTP sender email is invalid. Check SMTP_FROM/SMTP_USER in .env.");
  }
  return fromAddress;
}

function assertValidRecipientEmail(email) {
  const toEmail = normalizeEmail(email);
  if (!toEmail) {
    throw buildMailerError("Recipient email is missing for this account. Please update account email and retry.");
  }
  if (!isValidEmail(toEmail)) {
    throw buildMailerError("Recipient email is invalid for this account. Please update account email and retry.");
  }
  return toEmail;
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

async function sendMailWithTimeout(message) {
  try {
    const timeoutMs = getSmtpTimeoutMs();
    const sendMailPromise = getTransporter().sendMail(message);
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

    throw buildMailerError("Failed to send email. Verify SMTP configuration and try again.");
  }
}

async function sendEmail({ to, subject, text, html }) {
  const fromAddress = getFromAddress();
  const toEmail = assertValidRecipientEmail(to);

  await sendMailWithTimeout({
    from: fromAddress,
    to: toEmail,
    subject: String(subject || "").trim() || "Notification",
    text: String(text || "").trim(),
    html: html ? String(html) : undefined,
  });

  return { email: toEmail, status: "sent" };
}

function normalizeEmailList(recipients) {
  if (Array.isArray(recipients)) {
    return [...new Set(recipients.map((item) => normalizeEmail(item)).filter((item) => isValidEmail(item)))];
  }

  const raw = String(recipients || "").trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((item) => normalizeEmail(item)).filter((item) => isValidEmail(item)))];
}

async function sendBulkEmail(recipients, buildMessage) {
  const normalizedRecipients = normalizeEmailList(recipients);
  const summary = {
    requested: Array.isArray(recipients) ? recipients.length : normalizedRecipients.length,
    sent: [],
    failed: [],
    skipped: [],
  };

  if (normalizedRecipients.length === 0) {
    return summary;
  }

  for (const recipient of normalizedRecipients) {
    try {
      const message = typeof buildMessage === "function" ? buildMessage(recipient) : buildMessage;
      await sendEmail({
        to: recipient,
        subject: message?.subject,
        text: message?.text,
        html: message?.html,
      });
      summary.sent.push(recipient);
    } catch (err) {
      summary.failed.push({
        email: recipient,
        reason: String(err?.message || "Failed to send email"),
      });
    }
  }

  return summary;
}

async function sendPasswordResetOtpEmail(email, otpCode, expiryMinutes = 2) {
  const safeExpiry = Number.isInteger(Number(expiryMinutes)) && Number(expiryMinutes) > 0 ? Number(expiryMinutes) : 2;
  await sendEmail({
    to: email,
    subject: "Password Reset OTP",
    text: `Your OTP for password reset is: ${otpCode}\nThis OTP is valid for ${safeExpiry} minute${safeExpiry === 1 ? "" : "s"}.`,
  });
}

async function sendLoginOtpEmail(email, otpCode, expiryMinutes = 2) {
  const safeExpiry = Number.isInteger(Number(expiryMinutes)) && Number(expiryMinutes) > 0 ? Number(expiryMinutes) : 2;
  await sendEmail({
    to: email,
    subject: "Login OTP",
    text: `Your login OTP is: ${otpCode}\nThis OTP is valid for ${safeExpiry} minute${safeExpiry === 1 ? "" : "s"}.`,
  });
}

async function sendTimetableGeneratedEmails(recipients, payload = {}) {
  const subject = "New timetable generated";
  const textLines = [
    "New timetable generated",
    payload.versionName ? `Version: ${payload.versionName}` : "",
    payload.departmentName ? `Department: ${payload.departmentName}` : "",
    payload.branchName ? `Branch: ${payload.branchName}` : "",
    payload.semesterNumber ? `Semester: ${payload.semesterNumber}` : "",
    payload.academicYear ? `Academic Year: ${payload.academicYear}` : "",
    payload.pdfUrl ? `PDF: ${payload.pdfUrl}` : "",
    payload.portalUrl ? `Faculty Portal: ${payload.portalUrl}` : "",
  ].filter(Boolean);

  return sendBulkEmail(recipients, () => ({
    subject,
    text: textLines.join("\n"),
  }));
}

async function sendTimetableSharedEmails(recipients, payload = {}) {
  const subject = payload.sectionName
    ? `Student timetable shared for ${payload.sectionName}`
    : "Student timetable shared";
  const textLines = [
    String(payload.message || "").trim() || "Please find the shared timetable details below.",
    payload.sharedBy ? `Shared By: ${payload.sharedBy}` : "",
    payload.versionName ? `Version: ${payload.versionName}` : "",
    payload.sectionName ? `Section: ${payload.sectionName}` : "",
    payload.semesterNumber ? `Semester: ${payload.semesterNumber}` : "",
    payload.academicYear ? `Academic Year: ${payload.academicYear}` : "",
    payload.pdfUrl ? `PDF: ${payload.pdfUrl}` : "",
    payload.portalUrl ? `Portal: ${payload.portalUrl}` : "",
  ].filter(Boolean);

  return sendBulkEmail(recipients, () => ({
    subject,
    text: textLines.join("\n"),
  }));
}

async function sendAccountDeleteOtpEmail(email, otpCode, expiryMinutes = 2) {
  const safeExpiry = Number.isInteger(Number(expiryMinutes)) && Number(expiryMinutes) > 0 ? Number(expiryMinutes) : 2;
  await sendEmail({
    to: email,
    subject: "Account Deletion OTP",
    text: `Your OTP for account deletion is: ${otpCode}\nThis action is permanent and cannot be undone.\nThis OTP is valid for ${safeExpiry} minute${safeExpiry === 1 ? "" : "s"}.`,
  });
}

module.exports = {
  normalizeEmailList,
  sendBulkEmail,
  sendEmail,
  sendLoginOtpEmail,
  sendPasswordResetOtpEmail,
  sendAccountDeleteOtpEmail,
  sendTimetableGeneratedEmails,
  sendTimetableSharedEmails,
};
