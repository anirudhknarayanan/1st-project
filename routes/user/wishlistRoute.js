const express = require("express");
const router = express.Router();
const wishlistController = require("../../controllers/user/wishlistController");
const {userAuth} = require("../../middlewares/auth");

router.get("/wishlist", userAuth, wishlistController.getWishlist)
router.post("/addToWishlist", userAuth, wishlistController.addToWishlist)
router.get("/removeFromWishlist", userAuth, wishlistController.removeFromWishlist)
router.delete("/removeFromWishlist/:productId", userAuth, wishlistController.removeFromWishlist)




module.exports = router;