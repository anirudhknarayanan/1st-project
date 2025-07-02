const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController")
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController")
const { userAuth, adminAuth } = require("../middlewares/auth");
const multer = require("multer");
const storage = require("../helpers/multer");
const orderController = require("../controllers/admin/orderController");
const uploads = multer({ storage: storage })


router.get("/pageerror", adminController.getPageerror)
router.get("/", adminAuth, adminController.loadDashBoard)
router.get("/login", adminController.adminLogin)
router.post("/login", adminController.login)
router.get("/logout", adminController.logout)

router.get("/users", adminAuth, customerController.getAllusers)
router.post("/block/:id", adminAuth, customerController.userBlock)
router.post("/unblock/:id", adminAuth, customerController.userUnblock)

router.get("/category", adminAuth, categoryController.categoryInfo)
router.post("/addCategory", adminAuth, categoryController.addCategory)
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer)
router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer)
router.patch("/toggleCategory/:id", adminAuth, categoryController.toggleCategoryStatus);
router.get("/editCategory/:id", adminAuth, categoryController.getEditCategory)
router.post("/editCategory/:id", adminAuth, categoryController.updateCategory)


router.get("/brand", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand)
router.get("/blockBrand", adminAuth, brandController.blockBrand)
router.get("/unblockBrand", adminAuth, brandController.unblockBrand)
router.get("/deleteBrand", adminAuth, brandController.deleteBrand)

router.get("/orders",adminAuth,orderController.getOrderPage)
router.post("/updateOrder",adminAuth,orderController.updateOrder)
router.post("/cancelOrder",adminAuth,orderController.cancelOrder)
router.post("/approveReturn",adminAuth,orderController.approveReturn)
router.post("/rejectReturn/:orderId",adminAuth,orderController.rejectReturn)



router.get("/products", adminAuth, productController.getAllProducts);
router.get("/addProduct", adminAuth, productController.addProductpage)
router.post("/addProduct", adminAuth, uploads.array("images", 3), productController.addProduct)
router.post("/addProductOffer", adminAuth, productController.addProductOffer)
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer)
router.get("/blockProduct/:id", adminAuth, productController.blockProduct)
router.get("/unblockProduct/:id", adminAuth, productController.unblockProduct)
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.any(), productController.editProduct)
router.post("/deleteImage", adminAuth, productController.deleteSigleImage)
router.post("/deleteProduct",adminAuth,productController.deleteProduct)







module.exports = router;
