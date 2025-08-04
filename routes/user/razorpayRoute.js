const express = require("express");
const router = express.Router();

const razorpayController = require("../../controllers/user/razorpayControllers");
const {userAuth} = require("../../middlewares/auth");



router.post("/createOrder",userAuth,razorpayController.createOrder);
router.post("/verifyPayment",razorpayController.verifyPayment)


router.get("/paymentFailed/:orderId",userAuth,razorpayController.paymentFailed)
router.post("/retryPayment/:orderId",userAuth,razorpayController.retryPayment)

router.post("/verifyRetryPayment",userAuth,razorpayController.verifyRetryPayment)



module.exports = router;