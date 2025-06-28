const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema")
const Order = require('../../models/orderSchema')
const Coupon = require('../../models/coupenSchema')
//const Wallet = require('../../models/walletSchema')
const { getDiscountPrice, getDiscountPriceCart } = require("../../helpers/offerHelpers");
const fs = require('fs');
const path = require('path');
const { log } = require("console");


module.exports = {

    loadCheckout: async (req, res) => {
        try {
            const userId = req.session.user;

            let cart = await Cart.findOne({ userId }).populate({
                path: "items.productId",
                populate: { path: "category" }
            }).lean();

            if (!cart) {
                req.flash("error", "Your cart is empty.");
                return res.redirect("/cart");
            }

            // Filter out unavailable products
            const availableItems = cart.items.filter(item =>
                item.productId &&
                !item.productId.isBlocked &&
                item.productId.category &&
                item.productId.category.isListed
            );

            if (availableItems.length !== cart.items.length) {
                req.flash("error", "Some unavailable products or categories have been removed from your cart.");
            }

            // Update cart and recalculate total
            cart.items = availableItems;
            cart.cartTotal = cart.items.reduce((total, item) =>
                total + item.quantity * item.price, 0
            );

            
            // Fetch user and address
            const user = await User.findById(userId).lean();
            const addressDoc = await Address.findOne({ userId }).lean();
            const userAddress = addressDoc ? addressDoc.address : [];

            // Fetch valid coupons
            

              const cartTotal = cart.totalPrice;
              console.log("cart :",cart);
              
            const date = new Date();
            // const coupon = await Coupon.find({
            //     couponMinAmount: { $lte: cartTotal },
            //     isActive: true,
            //     limit: { $gt: 0 },
            //     couponValidity: { $gte: date }
            // });

            // Render checkout page
            res.render("user/userCheckout", {
                cart,
                user,
                userAddress,
                


                messages: req.flash()
            });

        } catch (error) {
            console.log("Error in checkout:", error);
            res.redirect("/pageNotFound");
        }
    }


}