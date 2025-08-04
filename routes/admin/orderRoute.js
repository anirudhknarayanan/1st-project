const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/admin/orderController");
const {adminAuth} = require("../../middlewares/auth");

router.get("/",adminAuth,orderController.getOrderPage);
router.post("/updateOrder",adminAuth,orderController.updateOrder);
router.post("/cancelOrder",adminAuth,orderController.cancelOrder);
router.post("/approveReturn",adminAuth,orderController.approveReturn)
router.post("/rejectReturn/:orderId",adminAuth,orderController.rejectReturn);

router.post('/approveItemReturn',adminAuth, orderController.approveItemReturn);
router.post('/rejectItemReturn',adminAuth, orderController.rejectItemReturn);




module.exports = router;