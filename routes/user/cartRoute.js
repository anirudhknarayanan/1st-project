const express = require("express");
const router = express.Router();
const cartController = require("../../controllers/user/cartControllers");
const {userAuth} = require("../../middlewares/auth");

router.get("/cart", userAuth, cartController.loadCart);
router.get("/cart/count", userAuth, cartController.getCartCount);
router.post("/addToCart", userAuth, cartController.addToCart);
router.delete("/cart/remove/:productId", userAuth, cartController.removeCartItem);




module.exports = router;