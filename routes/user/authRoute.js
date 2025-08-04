const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../../controllers/user/userController");
const profileController = require("../../controllers/user/profileController")
const {userAuth} = require("../../middlewares/auth") 


router.get("/signup", userController.signupPage);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.get("/login", userController.login);
router.post("/login", userController.postLogin);
router.post("/resend-otp", userController.resendOtp)
router.get("/", userController.loadHomePage);
router.get("/pageNotFound", userController.pageNotFound)

router.get("/logout", userController.logout)

router.get("/auth/google", passport.authenticate("google", { scope: ['profile', 'email'] }))
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/signup" }), (req, res) => {
    req.session.user = req.user._id;
    res.redirect("/shopp")
})



module.exports = router;