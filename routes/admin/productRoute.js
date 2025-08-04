const express = require("express");
const router = express.Router();
const productController = require("../../controllers/admin/productController");
const {adminAuth} = require("../../middlewares/auth");
const multer = require("multer");
const storage = require("../../helpers/multer");

const uploads = multer({ storage: storage })



router.get("/", adminAuth, productController.getAllProducts);
router.get("/addProduct", adminAuth, productController.addProductpage);
router.post("/addProduct", adminAuth, uploads.array("images", 3), productController.addProduct);
router.post("/addProductOffer", adminAuth, productController.addProductOffer)
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.any(), productController.editProduct)
router.get("/blockProduct/:id", adminAuth, productController.blockProduct)
router.get("/unblockProduct/:id", adminAuth, productController.unblockProduct);
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer);
router.post("/deleteProduct",adminAuth,productController.deleteProduct);
router.post("/deleteImage", adminAuth, productController.deleteSigleImage)



module.exports = router;