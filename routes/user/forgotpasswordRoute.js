const express = require("express");
const router = express.Router();

const profileController = require("../../controllers/user/profileController");

router.get("/forget-password", profileController.getforgotPassword);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPass);
router.post("/resend-forgot-otp", profileController.resendOtp);
router.post("/reset-password", profileController.postNewPassword);





module.exports = router;