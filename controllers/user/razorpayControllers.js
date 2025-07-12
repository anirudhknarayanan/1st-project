const Razorpay = require("razorpay");
const env = require("dotenv").config();
const crypto = require("crypto");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");


const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

module.exports = {


    createOrder: async (req, res) => {
        try {
            const { amount, currency } = req.body;

            console.log(amount, currency);

            const options = {
                amount: amount * 100, // Convert to paisa
                currency,
                receipt: `order_rcptid_${Date.now()}`,
                payment_capture: 1,

            };

            const order = await razorpayInstance.orders.create(options);
            res.status(200).json({
                success: true,
                order_id: order.id,
                amount: order.amount,
                currency: order.currency,
                key: process.env.RAZORPAY_KEY_ID
            });

        } catch (error) {


            console.error("Error creating order:", error);
            res.status(500).json({ success: false, error: "Failed to create order" });

        }
    },
    verifyPayment: async (req, res) => {
        try {
            console.log("✅ Route Hit");
            console.log("Headers:", req.headers);
            console.log("Body:", req.body);
            const {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                shippingAddress,
                orderedItems,
                totalAmount,
                // couponCode,
                //  discountAmount
            } = req.body;

            if (!req.session.user) {
                return res.status(401).json({ success: false, message: "Not authenticated" });
            }

            const userAddress = await Address.findOne({
                userId: req.session.user,
                "address._id": shippingAddress
            })

            if (!userAddress) {
                return res.status(400).json({ success: false, message: 'Invalid shipping address' });
            }

            const selectedAddress = userAddress.address.find(addr => addr._id.toString() === shippingAddress);

            console.log("selectedAddress", selectedAddress)

            if (!selectedAddress) {
                return res.status(400).json({ success: false, message: 'Selected address not found' });
            }


            const parsedOrderItems = typeof orderedItems === 'string' ? JSON.parse(orderedItems) : orderedItems;



            const productIds = parsedOrderItems.map(item => item.productId);
            const products = await Product.find({ _id: { $in: productIds } });

            const transformedOrderItems = parsedOrderItems.map(item => {
                const product = products.find(p => p._id.toString() === item.productId.toString());
                return {
                    productId: product._id,
                    productName: product.productName,
                    quantity: item.quantity,
                    price: item.price,
                    totalPrice: item.price * item.quantity
                };
            });

            const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                .digest("hex");


            if (generatedSignature === razorpay_signature) {

                const newOrder = new Order({
                    user_id: req.session.user,
                    address_id: shippingAddress,
                    shippingAddress: {
                        addressType: selectedAddress.addressType,
                        name: selectedAddress.name,
                        city: selectedAddress.city,
                        landMark: selectedAddress.landMark,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                        phone: selectedAddress.phone,
                        altPhone: selectedAddress.altPhone
                    },
                    payment_method: "razorpay",
                    order_items: transformedOrderItems,
                    total: totalAmount,
                    finalAmount: totalAmount,
                    status: "pending",
                    paymentStatus: "success",
                    //  couponApplied: couponCode ? true : false,
                    // discount: discountAmount || 0,
                    razorpay_order_id,
                    razorpay_payment_id
                });

                const savedOrder = await newOrder.save();



                let cart = await Cart.findOne({ userId: req.session.user });

                if (!cart) {
                    cart = new Cart({
                        userId: req.session.user,
                        items: [],
                        cartTotal: 0
                    });

                } else {
                    cart.items = [];
                    cart.cartTotal = 0;
                }

                await cart.save();

                orderedItems.forEach(async (item) => {
                    await Product.updateOne(
                        { _id: item.productId._id },
                        { $inc: { quantity: -item.quantity } }
                    )
                })

                res.json({
                    success: true,
                    orderId: savedOrder._id
                });





            } else {
                const parsedOrderItems = typeof orderedItems === 'string' ? JSON.parse(orderedItems) : orderedItems;


                const productIds = parsedOrderItems.map(item => item.productId);
                const products = await Product.find({ _id: { $in: productIds } });

                const transformedOrderItems = parsedOrderItems.map(item => {
                    const product = products.find(p => p._id.toString() === item.productId.toString());
                    return {
                        productId: product._id,
                        productName: product.productName,
                        quantity: item.quantity,
                        price: item.price,
                        totalPrice: item.price * item.quantity
                    };
                });
                console.log("Payment failed: Signature Mismatch");
                const failedOrder = new Order({
                    user_id: req.session.user,
                    address_id: shippingAddress,
                    shippingAddress: {
                        addressType: selectedAddress.addressType,
                        name: selectedAddress.name,
                        city: selectedAddress.city,
                        landMark: selectedAddress.landMark,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                        phone: selectedAddress.phone,
                        altPhone: selectedAddress.altPhone
                    },
                    payment_method: "razorpay",
                    order_items: transformedOrderItems,
                    total: totalAmount,
                    finalAmount: totalAmount,
                    status: "failed",
                    //couponApplied: couponCode ? true : false,
                    order_items: transformedOrderItems,
                    total: totalAmount,
                    finalAmount: totalAmount,
                    status: "failed",
                    //  couponApplied: couponCode ? true : false,
                    //discount: discountAmount || 0,
                    razorpay_order_id
                });
                await failedOrder.save();

                res.status(400).json({ success: false, message: "Payment verification failed", orderId: failedOrder._id });



            }




        } catch (error) {


            console.error("Payment Verification Error:", error);
            res.status(500).json({ success: false, message: "Failed to verify payment" });
        }
    },


    paymentFailed: async (req, res) => {
        try {
            const orderId = req.params.orderId;

            let order = await Order.findById(orderId).lean().catch(() => null);

            console.log("payment failed order : ", order);


            if (!order) {
                order = await Order.findOne({ razorpay_order_id: orderId }).lean();
            }

            if (!order || order.user_id.toString() !== req.session.user) {
                return res.redirect('/profile');
            }

            res.render("user/failure", { order, user: req.session.userData })
        } catch (error) {

            console.error("Error rendering failure page:", error);
            res.redirect('/profile');

        }
    },

    retryPayment: async (req, res) => {
        try {
            const { orderId } = req.params;
            const failedOrder = await Order.findById(orderId);

            if (!failedOrder || failedOrder.user_id.toString() !== req.session.user) {
                return res.status(404).json({ success: false, message: "Order not found or not authorized" });
            }

            if (failedOrder.status !== "failed") {
                return res.status(400).json({ success: false, message: "This order cannot be retried" });
            }

            const options = {
                amount: failedOrder.total * 100,
                currency: "INR",
                receipt: `retry_order_${orderId}`,
                payment_capture: 1
            };

            const order = await razorpayInstance.orders.create(options);

            res.json({
                success: true,
                order_id: order.id,
                amount: order.amount,
                currency: order.currency,
                key: process.env.RAZORPAY_KEY_ID
            });




        } catch (error) {
            console.error("Retry Payment Error:", error);
            res.status(500).json({ success: false, message: "Failed to retry payment" });
        }
    },

    verifyRetryPayment: async (req, res) => {
        try {

            const {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                orderId
            } = req.body;


            if (!req.session.user) {
                return res.status(401).json({ success: false, message: "Not authenticated" });
            }

            const failedOrder = await Order.findById(orderId);
            if (!failedOrder) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                .digest("hex");


            if (generatedSignature === razorpay_signature) {
                failedOrder.status = "pending";
                failedOrder.paymentStatus = "success";
                failedOrder.razorpay_order_id = razorpay_order_id;
                failedOrder.razorpay_payment_id = razorpay_payment_id;
                await failedOrder.save();


                let cart = await Cart.findOne({ userId: req.session.user });

                if (!cart) {
                    cart = new Cart({
                        userId: req.session.user,
                        items: [],
                        cartTotal: 0
                    });

                } else {
                    cart.items = [];
                    cart.cartTotal = 0;
                }

                await cart.save();

                if (failedOrder.order_items && failedOrder.order_items.length > 0) {
                    for (const item of failedOrder.order_items) {
                        await Product.updateOne(
                            { _id: item.productId },
                            { $inc: { quantity: -item.quantity } }
                        );
                    }
                }

                res.json({
                    success: true,
                    orderId: failedOrder._id
                });
            } else {
                console.log("Retry Payment failed: Signature Mismatch");
                res.status(400).json({ success: false, message: "Payment verification failed" });
            }

        } catch (error) {
            console.error("Retry Payment Verification Error:", error);
            res.status(500).json({ success: false, message: "Failed to verify payment" });
        }
    }

}