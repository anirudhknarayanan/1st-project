const express = require("express");
const router = express.Router();

const adminController = require("../../controllers/admin/adminController");

router.get("/login", adminController.adminLogin);
router.post("/login",adminController.login);
router.get("/logout", adminController.logout);

module.exports = router; 