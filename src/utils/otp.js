function generateOtp(length = 6) {
  let otp = "";
  for (let i = 0; i < length; i += 1) {
    otp += Math.floor(Math.random() * 10).toString();
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

