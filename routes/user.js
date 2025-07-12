const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const walletController = require("../controllers/user/walletControllers")
const passport = require("passport")
const { userAuth } = require("../middlewares/auth")
const multer = require("multer");
const storage = require("../helpers/multer");
const wishlistController = require("../controllers/user/wishlistController")
const cartControllers = require("../controllers/user/cartControllers")
const checkoutControllers = require("../controllers/user/checkoutControllers")
const razorpayControllers = require("../controllers/user/razorpayControllers")

const uploads = multer({ storage: storage })




// router.get("/women",(req,res)=>{
//     res.render("user/women")
// })
router.get("/about", (req, res) => {
    res.render("user/about")
})
router.get("/contact", (req, res) => {
    res.render("user/contact")
})



//user auth

router.get("/signup", userController.signupPage)
router.post("/signup", userController.signup)
router.post("/verify-otp", userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)
router.get("/auth/google", passport.authenticate("google", { scope: ['profile', 'email'] }))
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/signup" }), (req, res) => {
    req.session.user = req.user._id;
    res.redirect("/shopp")
})
router.get("/login", userController.login)
router.post("/login", userController.postLogin)
router.get("/pageNotFound", userController.pageNotFound)
router.get("/profile", profileController.showProfile)
router.get("/logout", userController.logout)

//address

router.get("/addAddress", userAuth, profileController.addAddress)
router.post("/addAddress", userAuth, profileController.postAddress)
router.get("/editAddress/:id", userAuth, profileController.editAddress)
router.post("/editAddress/:id", userAuth, profileController.postEditAddress)
router.get("/deleteAddress/:id", userAuth, profileController.deleteAddress)

//email

router.get("/changeEmail", userAuth, profileController.changeEmail)
router.post("/changeEmail", userAuth, profileController.postChangeEmail)
router.post("/resetEmail", userAuth, profileController.resetEmail)
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOtp)



//in profile change password

router.get("/changePassword", userAuth, profileController.getChangePassword)
router.post("/changePassword", userAuth, profileController.changePasswordValid)
router.post("/verify-changePassword-otp", userAuth, profileController.verifychangePasswordotp)

router.post("/uploadProfileImage", userAuth, uploads.single("profileImage"), profileController.uploadProfileImg)
router.post("/updateName",userAuth,profileController.updateUserName)
router.post("/updatePhone",userAuth,profileController.updateUserPhone)

//forget password 

router.get("/forget-password", profileController.getforgotPassword)
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp)
router.get("/reset-password", profileController.getResetPass)
router.post("/resend-forgot-otp", profileController.resendOtp)
router.post("/reset-password", profileController.postNewPassword)

//products management

router.get("/", userController.loadHomePage);
router.get("/shopp", userAuth, userController.loadShoppingPage);
router.get("/filter", userAuth, userController.filterProduct)
router.get("/filterPrice", userAuth, userController.filterByPrice)
router.post("/search", userAuth, userController.searchProducts)
router.get("/productDetails", userAuth, productController.productDetails)

// wish list management

router.get("/wishlist", userAuth, wishlistController.getWishlist)
router.post("/addToWishlist", userAuth, wishlistController.addToWishlist)
router.get("/removeFromWishlist", userAuth, wishlistController.removeFromWishlist)



//cart mnagement
router.get("/cart", userAuth, cartControllers.loadCart)
router.post("/addToCart", userAuth, cartControllers.addToCart)
router.delete("/cart/remove/:productId", userAuth, cartControllers.removeCartItem)

//checkout management

router.get("/checkout", userAuth, checkoutControllers.loadCheckout)
router.post("/checkout", userAuth, checkoutControllers.placeOrder)
router.post("/editCheckoutAddress", userAuth, checkoutControllers.editCheckoutAddress)
router.post("/addCheckoutAddress", userAuth, checkoutControllers.addCheckoutAddress)
router.get("/vieworder/:id", userAuth, checkoutControllers.viewOrder)
router.patch("/cancelOrder/:orderId", userAuth, checkoutControllers.cancelOrder)
router.get("/invoice/:id", userAuth, checkoutControllers.generateInvoice)


router.post("/returnOrder/:orderId", userAuth, checkoutControllers.returnOrder)
router.post("/addMoney", userAuth, walletController.addMoney)


router.patch("/cancelOrderItem/:orderId/:productId",userAuth,checkoutControllers.cancelOrderItem)
router.patch("/returnOrderItem/:orderId/:productId", userAuth, checkoutControllers.returnOrderItem)



//razorpay


router.post("/validateCheckoutItems",userAuth,checkoutControllers.validateCheckoutItems)
router.post("/createOrder",userAuth,razorpayControllers.createOrder);
router.post("/verifyPayment",razorpayControllers.verifyPayment)
//router.post("/verifyPayments",userAuth,checkoutControllers.verifyPayments)

router.get("/paymentFailed/:orderId",userAuth,razorpayControllers.paymentFailed)
router.post("/retryPayment/:orderId",userAuth,razorpayControllers.retryPayment)

router.post("/verifyRetryPayment",userAuth,razorpayControllers.verifyRetryPayment)







module.exports = router;