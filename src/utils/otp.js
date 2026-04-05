const crypto = require("crypto");

function generateOtp(length = 6) {
  const otpLength = Number.isInteger(Number(length)) ? Math.max(1, Number(length)) : 6;
  let otp = "";
  for (let i = 0; i < otpLength; i += 1) {
    otp += crypto.randomInt(0, 10).toString();
  }
  return otp;
}

function maskMobileNumber(mobileNumber) {
  if (!mobileNumber || mobileNumber.length < 4) {
    return "****";
  }
  return `${"*".repeat(Math.max(0, mobileNumber.length - 4))}${mobileNumber.slice(
    -4
  )}`;
}

module.exports = { generateOtp, maskMobileNumber };
