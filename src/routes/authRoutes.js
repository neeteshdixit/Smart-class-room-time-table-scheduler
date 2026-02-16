const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const { validateRequest } = require("../utils/validation");
const { optionalAuth } = require("../middleware/auth");
const { uploadProfilePhoto } = require("../middleware/upload");

const router = express.Router();

const signupValidator = [
  body("faculty_id").trim().notEmpty(),
  body("full_name").trim().notEmpty(),
  body("designation").trim().notEmpty(),
  body("email").trim().isEmail(),
  body("mobile_number").trim().matches(/^[0-9]{10,15}$/),
  body("password").isLength({ min: 8 }),
  body("confirm_password").notEmpty(),
  body("gender").trim().notEmpty(),
  body("dob").isISO8601(),
  body("qualification").trim().notEmpty(),
  body("experience_years").isFloat({ min: 0 }),
  body("address").trim().notEmpty(),
  body("joining_date").isISO8601(),
  body("role").optional().isIn(["FACULTY", "ADMIN", "USER", "Faculty", "Admin", "User", "faculty", "admin", "user"]),
  body("department_ids").optional(),
  body("subject_ids").optional(),
  body("employee_type").optional().trim().notEmpty(),
  body("office_location").optional().trim(),
  validateRequest,
];

const loginValidator = [body("identifier").trim().notEmpty(), body("password").notEmpty(), validateRequest];
const verifyLoginOtpValidator = [
  body("login_token").notEmpty(),
  body("otp_code").matches(/^[0-9]{6}$/),
  validateRequest,
];
const resendOtpValidator = [body("login_token").notEmpty(), validateRequest];
const forgotPasswordValidator = [
  body("email").optional().trim().isEmail(),
  body("faculty_id").optional().trim().notEmpty(),
  body().custom((value) => {
    if (!value?.email && !value?.faculty_id) {
      throw new Error("Email or Faculty ID is required");
    }
    return true;
  }),
  validateRequest,
];
const verifyResetOtpValidator = [
  body("email").trim().isEmail(),
  body("otp").trim().matches(/^[0-9]{6}$/),
  validateRequest,
];
const resetPasswordValidator = [
  body("email").trim().isEmail(),
  body("new_password").isLength({ min: 8 }),
  body("confirm_password").optional().notEmpty(),
  validateRequest,
];

router.get("/signup-meta", optionalAuth, authController.getSignupMeta);
router.get("/signup-options", authController.getSignupOptions);
router.post("/signup", optionalAuth, uploadProfilePhoto, signupValidator, authController.signup);
router.post("/login", loginValidator, authController.login);
router.post("/verify-login-otp", verifyLoginOtpValidator, authController.verifyLoginOtp);
router.post("/resend-otp", resendOtpValidator, authController.resendOtp);
router.post("/forgot-password", forgotPasswordValidator, authController.forgotPassword);
router.post("/verify-otp", verifyResetOtpValidator, authController.verifyOtp);
router.post("/reset-password", resetPasswordValidator, authController.resetPassword);

module.exports = router;
