const express = require("express");
const router = express.Router();
const customerController = require("../../controllers/admin/customerController");
const {adminAuth} = require("../../middlewares/auth")

router.get("/",adminAuth,customerController.getAllusers);
router.post("/block/:id", adminAuth, customerController.userBlock);
router.post("/unblock/:id", adminAuth, customerController.userUnblock);

module.exports = router;


