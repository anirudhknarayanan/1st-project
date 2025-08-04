const express = require("express")
const router = express.Router();
const checkoutControllers = require("../../controllers/user/checkoutControllers")
const {userAuth} = require("../../middlewares/auth");

router.get("/checkout", userAuth, checkoutControllers.loadCheckout)
router.post("/checkout", userAuth, checkoutControllers.placeOrder)
router.post("/editCheckoutAddress", userAuth, checkoutControllers.editCheckoutAddress)
router.post("/addCheckoutAddress", userAuth, checkoutControllers.addCheckoutAddress)
router.get("/vieworder/:id", userAuth, checkoutControllers.viewOrder)
router.patch("/cancelOrder/:orderId", userAuth, checkoutControllers.cancelOrder)
router.get("/invoice/:id", userAuth, checkoutControllers.generateInvoice)
router.post("/validateCheckoutItems",userAuth,checkoutControllers.validateCheckoutItems)


router.post("/applyCoupon",userAuth,checkoutControllers.applyCoupon)
router.post("/removeCoupon",userAuth,checkoutControllers.removeCoupon)


router.post("/returnOrder/:orderId", userAuth, checkoutControllers.returnOrder)



router.patch("/cancelOrderItem/:orderId/:productId",userAuth,checkoutControllers.cancelOrderItem)
router.patch("/returnOrderItem/:orderId/:productId", userAuth, checkoutControllers.returnOrderItem)




module.exports = router;
