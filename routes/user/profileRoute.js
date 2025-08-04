const express = require("express");
const router = express.Router();
const {userAuth} = require("../../middlewares/auth");
const profileController = require("../../controllers/user/profileController")
const walletController = require("../../controllers/user/walletControllers")
const multer = require("multer");
const storage = require("../../helpers/multer");
const uploads = multer({ storage: storage })

router.get("/profile", profileController.showProfile);
router.post("/uploadProfileImage", userAuth, uploads.single("profileImage"), profileController.uploadProfileImg);
router.post("/updateName",userAuth,profileController.updateUserName);
router.post("/updatePhone",userAuth,profileController.updateUserPhone);

//change password

router.get("/changePassword", userAuth, profileController.getChangePassword);
router.post("/changePassword", userAuth, profileController.changePasswordValid);
router.post("/verify-changePassword-otp", userAuth, profileController.verifychangePasswordotp);

//change email

router.get("/changeEmail", userAuth, profileController.changeEmail)
router.post("/changeEmail", userAuth, profileController.postChangeEmail)
router.post("/resetEmail", userAuth, profileController.resetEmail)
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOtp);

//referal

router.get("/referralDetails", userAuth, profileController.showReferralDetails);
router.post("/addMoney", userAuth, walletController.addMoney)






module.exports = router;