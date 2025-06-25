const express = require("express")
const router = express.Router()
const userController =require("../controllers/user/userController")
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const passport = require("passport")
const { userAuth } = require("../middlewares/auth")
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage })




// router.get("/women",(req,res)=>{
//     res.render("user/women")
// })
router.get("/about",(req,res)=>{
    res.render("user/about")
})
router.get("/contact",(req,res)=>{
    res.render("user/contact")
})
router.get("/wishlist",userAuth,(req,res)=>{
    res.render("user/wishlist")
})
router.get("/cart",userAuth,(req,res)=>{
    res.render("user/cart")
})
router.get("/checkout",(req,res)=>{
    res.render("user/checkout")
})



router.get("/signup",userController.signupPage)
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get("/auth/google",passport.authenticate("google",{scope:['profile','email']}))
router.get("/auth/google/callback",passport.authenticate("google", {failureRedirect:"/signup"}),(req,res)=>{
     req.session.user = req.user._id;
    res.redirect("/shopp")
})
router.get("/login",userController.login)
router.post("/login",userController.postLogin)
router.get("/pageNotFound",userController.pageNotFound)
router.get("/profile",profileController.showProfile)
router.get("/logout",userController.logout)


router.get("/addAddress",userAuth,profileController.addAddress)
router.post("/addAddress",userAuth,profileController.postAddress)
router.get("/editAddress/:id",userAuth,profileController.editAddress)
router.post("/editAddress/:id",userAuth,profileController.postEditAddress)
router.get("/deleteAddress/:id",userAuth,profileController.deleteAddress)
router.get("/changeEmail",userAuth,profileController.changeEmail)
router.post("/changeEmail",userAuth,profileController.postChangeEmail)
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp)
router.get("/new-email-page",userAuth,profileController.getResetEmail)
router.post("/resetEmail",userAuth,profileController.resetEmail)
router.get("/changePassword",userAuth,profileController.getChangePassword)
router.post("/changePassword",userAuth,profileController.changePasswordValid)
router.post("/verify-changePassword-otp",userAuth,profileController.verifychangePasswordotp)
router.post("/uploadProfileImage",userAuth,uploads.single("profileImage"),profileController.uploadProfileImg)


router.get("/forget-password",profileController.getforgotPassword)
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPass)
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword)



router.get("/",userController.loadHomePage);
router.get("/shopp",userAuth,userController.loadShoppingPage);
router.get("/filter",userAuth,userController.filterProduct)
router.get("/filterPrice",userAuth,userController.filterByPrice)
router.post("/search",userAuth,userController.searchProducts)
router.get("/productDetails",userAuth,productController.productDetails)





module.exports = router;