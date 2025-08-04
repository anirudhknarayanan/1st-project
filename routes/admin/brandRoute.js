const express = require("express");
const router = express.Router();
const brandController  = require("../../controllers/admin/brandController");
const {adminAuth} = require("../../middlewares/auth");
const multer = require("multer");
const storage = require("../../helpers/multer");

const uploads = multer({ storage: storage })

router.get("/", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand);
router.post("/blockBrand", adminAuth, brandController.blockBrand);
router.post("/unblockBrand", adminAuth, brandController.unblockBrand);
router.delete("/deleteBrand", adminAuth, brandController.deleteBrand);


module.exports = router