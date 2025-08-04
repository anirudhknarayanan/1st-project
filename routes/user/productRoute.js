const express = require("express");
const router = express.Router();

const userController = require("../../controllers/user/userController");
const productController = require("../../controllers/user/productController");
const {userAuth} = require("../../middlewares/auth");

router.get("/", userController.loadHomePage);
router.get("/shopp", userAuth, userController.loadShoppingPage);
router.get("/filter", userAuth, userController.filterProduct);
router.get("/filterPrice", userAuth, userController.filterByPrice);
router.post("/search", userAuth, userController.searchProducts);
router.get("/productDetails", userAuth, productController.productDetails);





module.exports = router; 