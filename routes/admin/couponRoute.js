const express = require("express");
const router = express.Router();
const couponController = require("../../controllers/admin/couponController");
const {adminAuth} = require("../../middlewares/auth");


router.get("/",adminAuth,couponController.getCouponpage);
router.post("/addCoupon",adminAuth,couponController.addCoupon);
router.patch("/toggle-coupon/:id",adminAuth,couponController.toggleCoupon);




module.exports = router;