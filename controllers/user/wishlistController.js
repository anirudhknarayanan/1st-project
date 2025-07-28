const User = require("../../models/userSchema");
const Product = require("../../models/productSchema")
const Wishlist = require("../../models/wishlistSchema")
const Cart = require("../../models/cartSchema")
const { getDiscountPriceCart, getDiscountPrice } = require("../../helpers/offerHelpers");
const Address = require("../../models/addressSchema");

module.exports = {
  getWishlist: async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = 5;
      const userId = req.session.user;

      const wishlist = await Wishlist.findOne({ userId })
        .populate({
          path: "items.productId",
          populate: { path: "category" }
        }).lean();

        const relatedProducts = await Product.find({isBlocked : false}).limit(4).lean();
                  console.log("related products:",relatedProducts)

      if (!wishlist || wishlist.items.length === 0) {
        return res.render("user/wishlist", {
          user: req.session.userData,
          wishlist: [],
          currentPage: 1,
          totalPages: 0,
          relatedProducts
        });
      }


      const processedItems = wishlist.items.map(item => ({
        ...item,
        productId: getDiscountPriceCart(item.productId)
      }));

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedItems = processedItems.slice(startIndex, endIndex);

      const totalItems = processedItems.length;
      const totalPages = Math.ceil(totalItems / limit);
      console.log(wishlist);

        


      res.render("user/wishlist", {
        user: req.session.userData,
        wishlist: { ...wishlist, items: paginatedItems },
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        relatedProducts
      });
    } catch (error) {
      console.error("Error in load wishlist:", error);
      res.status(500).redirect("/userProfile");
    }
  },



  addToWishlist: async (req, res) => {
    try {
      const userId = req.session.user
      const { productId } = req.body

      if (!userId) {
        return res.status(401).json({ success: false, message: "User not logged in" });
      }

      let wishlist = await Wishlist.findOne({ userId })

      if (!wishlist) {
        wishlist = new Wishlist({ userId: userId, items: [] });
      }

      const cart = await Cart.findOne({ userId, "items.productId": productId });

      if (cart) {
        return res.status(400).json({ success: false, message: "Item is already in the cart" });
      }

      const existingItemIndex = wishlist.items.findIndex(item => item.productId.toString() === productId);
      if (existingItemIndex !== -1) {
        return res.status(200).json({ success: false, message: "Item already in wishlist" });
      }

      wishlist.items.push({ productId })

      await wishlist.save()

      res.status(200).json({ success: true, message: "Added to wishlist" })
    } catch (error) {
      console.log("error in add to wishlist", error)
      res.status(500).json({ success: false, message: "Internal server error" })
    }
  },
  removeFromWishlist: async (req, res) => {
    try {
      const { productId } = req.query;
      const userId = req.session.user;

      const wishlist = await Wishlist.findOne({ userId });

      if (wishlist) {
        const index = wishlist.items.findIndex(
          item => item.productId.toString() === productId
        );

        if (index !== -1) {
          wishlist.items.splice(index, 1);
          await wishlist.save();

          // ✅ Return success response
          return res.json({ success: true, message: "Item removed from wishlist." });
        }
      }

      // ✅ Even if item not found, return JSON
      return res.json({ success: false, message: "Item not found in wishlist." });

    } catch (error) {
      console.error("Error removing from wishlist:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  },



}


