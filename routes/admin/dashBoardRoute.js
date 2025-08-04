const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/admin/adminController");
const { adminAuth } = require("../../middlewares/auth");

router.get("/", adminAuth, adminController.loadDashBoard);

// Dashboard Data API
router.get("/dashboard-data", adminAuth, adminController.getDashboardDataAPI);

// Page error handler (optional)
router.get("/pageerror", adminController.getPageerror);

module.exports = router;