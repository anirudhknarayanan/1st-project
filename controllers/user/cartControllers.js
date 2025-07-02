const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema")
const { getDiscountPrice, getDiscountPriceCart } = require("../../helpers/offerHelpers")

module.exports = {

    loadCart: async (req, res) => {
        try {
            const userId = req.session.user;
            let cart = await Cart.findOne({ userId }).populate({
                path: "items.productId",
                populate: { path: "category" }
            }).lean()


            if (!cart) {
                return res.render("user/cart", {
                    user: req.session.userData,
                    cart: {
                        items: [],
                        totalPrice: 0
                    }
                })

            }
            const processedData = cart.items.map((item) => {
                if (!item.productId) return null;

                const productAvailable = item.productId.isBlocked === false;
                const categoryAvailable = item.productId.category && item.productId.category.isListed;

                item.productId.isAvailable = productAvailable && categoryAvailable;

                return { ...item, productId: getDiscountPriceCart(item.productId) };

            }).filter((item => item && item.productId));
            console.log("your prossedData:", processedData)
            cart.items = processedData;

            cart.cartTotal = cart.items.reduce((total, item) => {
                return total + (item.productId.isAvailable ? item.totalPrice : 0);
            }, 0);

            console.log("your cart detailes", cart.items);



            res.render("user/userCart", {
                user: req.session.userData,
                cart
            })
        } catch (error) {
            console.error("Error loading cart:", error);
            res.status(500).send("Failed to load cart");
        }
    },

    addToCart: async (req, res) => {
        try {
            const { productId, quantity } = req.body;
            const userId = req.session.user;

            if (!productId) {
                return res.status(400).json({
                    success: false,
                    message: "productId is required"
                })
            }
            const product = await Product.findById(productId).populate("category");
            console.log("products : ", product);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }
            const itemQuantity = parseInt(quantity) || 1;
            const { finalPrice, appliedOffer, regularPrice } = getDiscountPrice(product);
            console.log("this is your final price : ", finalPrice);
            let cart = await Cart.findOne({ userId })
            console.log("cart is : ", cart)

            if (!cart) {
                cart = new Cart({
                    userId,
                    items: [],
                    cartTotal: 0
                })
            }

            const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId.toString());

            if (existingItemIndex > -1) {
                let newQuantity = cart.items[existingItemIndex].quantity + itemQuantity;

                if (newQuantity > 5) {
                    return res.status(400).json({
                        success: false,
                        message: "You can only order up to 5 items"
                    });
                }
                if (newQuantity > product.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: "You can not order more than available stock"
                    });
                }
                if (newQuantity < 1) {
                    return res.status(400).json({
                        success: false,
                        message: "You can not order less than 1 item"
                    });
                }


                cart.items[existingItemIndex].quantity = newQuantity;
                cart.items[existingItemIndex].totalPrice = newQuantity * finalPrice;

            } else {

                cart.items.push({
                    productId,
                    quantity: itemQuantity,
                    price: finalPrice,
                    totalPrice: finalPrice * itemQuantity,
                    appliedOffer : appliedOffer
                });


            }
            cart.cartTotal = cart.items.reduce((total, item) => {
                return total + (Number(item.totalPrice) || 0);
            }, 0);



            await cart.save();


            res.status(200).json({
                success: true,
                message: "Product added to cart successfully",
                cartTotal: cart.cartTotal,
                itemsCount: cart.items.length

            });


        } catch (error) {
            console.error("Error in add to cart:", error);
            res.status(500).json({
                success: false,
                message: "Failed to add product to cart \n LOGIN FIRST"
            });

        }

    },
    removeCartItem: async (req, res) => {
        try {
            const productId = req.params.productId;
            console.log("productID : ",productId);
            
            const userId = req.session.user;
            const cart = await Cart.findOne({ userId })
            if (!cart) {
                res.status(404).json({ success: false, message: "Cart not found" })
            }
            console.log("user have cart : ", cart);

            const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
            console.log("Found item index:", itemIndex);

            if (itemIndex === -1) {
                return res.status(404).json({ success: false, message: 'Item not found in cart' });
            }

            cart.items.splice(itemIndex, 1);

            cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
            await cart.save();

            res.status(200).json({ success: true, message: "item removed from cart" })


        } catch {
            console.error("Error in removeCartItem:", error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
}