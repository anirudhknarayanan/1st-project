const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/admin/orderController");
const {adminAuth} = require("../../middlewares/auth");

router.get("/",adminAuth,orderController.getSalesReport);
router.get("/salesReportPDF/pdf",adminAuth,orderController.getSalesReportPDF)
router.get("/salesReportExcel/excel",adminAuth,orderController.getSalesReportExcel)




module.exports = router;