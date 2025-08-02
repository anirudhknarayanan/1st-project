const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema")
const Order = require('../../models/orderSchema')
const Coupon = require('../../models/coupenSchema')
const Wallet = require('../../models/walletSchema')
const { getDiscountPrice, getDiscountPriceCart } = require("../../helpers/offerHelpers");
// Import referral helpers
const { getUserReferralCoupons, validateReferralCoupon, markReferralCouponAsUsed } = require("../../helpers/referralHelpers");
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');

const fs = require('fs');
const path = require('path');

const { param } = require("../../app");


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
            ).map(item => {
                // ✅ RECALCULATE: Get current offer information for each product
                const currentOfferData = getDiscountPrice(item.productId);

                // ✅ DEBUG: Log checkout offer information
                console.log(`CHECKOUT DEBUG - Product: ${item.productId.productName}`);
                console.log(`CHECKOUT DEBUG - Current Offer Data:`, currentOfferData);

                // ✅ CALCULATE: Amount saved per item (same as cart controller)
                const regularPrice = item.productId.regularPrice;
                const salePrice = item.productId.salePrice;
                const savedPerItem = regularPrice - salePrice;
                const totalSaved = savedPerItem * item.quantity;

                // ✅ UPDATE: Use current offer data instead of stored cart data
                const updatedItem = {
                    ...item,
                    appliedOffer: currentOfferData?.appliedOffer || 0,
                    appliedOfferType: currentOfferData?.appliedOfferType || null,
                    price: currentOfferData?.finalPrice || item.productId.salePrice,
                    totalPrice: (currentOfferData?.finalPrice || item.productId.salePrice) * item.quantity,
                    savedPerItem: savedPerItem,
                    totalSaved: totalSaved,
                    hasOffer: (currentOfferData?.appliedOffer || 0) > 0
                };

                console.log(`CHECKOUT DEBUG - Has Offer: ${updatedItem.hasOffer}, Applied Offer: ${updatedItem.appliedOffer}%, Type: ${updatedItem.appliedOfferType}`);
                return updatedItem;
            });

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

            // ✅ FETCH WALLET BALANCE FROM WALLET SCHEMA
            const wallet = await Wallet.findOne({ userId }).lean();
            const walletBalance = wallet ? wallet.balance : 0;

            // Fetch valid coupons


            const cartTotal = cart.cartTotal;
            console.log("cart :", cart);

            const date = new Date();
            const coupon = await Coupon.find({
                couponMinAmount: { $lte: cartTotal },
                isActive: true,
                limit: { $gt: 0 },
                couponValidity: { $gte: date }
            }).lean();

            // Get user's referral coupons
            const referralCoupons = await getUserReferralCoupons(userId);
            const availableReferralCoupons = referralCoupons.filter(coupon => coupon.status === 'unused');

            console.log("available coupon : ,", coupon)
            console.log("available referral coupons : ,", availableReferralCoupons)

            //Render checkout page
            res.render("user/userCheckout", {
                cart,
                user: { ...user, walletBalance }, // ✅ ADD WALLET BALANCE TO USER OBJECT
                coupon,
                referralCoupons: availableReferralCoupons,
                userAddress,
                cartItemsJSON: JSON.stringify(
                    cart.items.map(item => ({
                        productId: item.productId._id.toString(),
                        quantity: item.quantity,
                        price: item.productId.salePrice
                    }))
                ),
                messages: req.flash()
            });


        } catch (error) {
            console.log("Error in checkout:", error);
            res.redirect("/pageNotFound");
        }
    },


    editCheckoutAddress: async (req, res) => {

        try {
            const userId = req.session.user;

            const {
                address_id,
                name,
                addressType,
                city,
                state,
                landMark,
                pincode,
                phone,
                altPhone
            } = req.body;

            if (!address_id) {
                console.log("Invalid Address ID:", address_id);
                return res.status(400).json({ error: "Invalid address ID" });
            }
            const address = await Address.findOne({ userId: userId, "address._id": address_id })

            console.log(address);


            if (!address) {
                return res.status(404).json({ error: "Address not found" });
            }

            const addressIndex = address.address.findIndex(addr => addr._id.toString() === address_id);
            if (addressIndex === -1) {
                return res.status(404).json({ error: "Address not found in array" });
            }

            address.address[addressIndex] = {
                ...address.address[addressIndex],
                name,
                addressType,
                city,
                state,
                landMark,
                pincode,
                phone,
                altPhone
            };

            await address.save();
            res.redirect('/checkout');
        } catch (error) {
            console.log("error in editCheckoutAddress", error);
            res.status(500).json({ error: "Internal server error" });
        }




    },

    addCheckoutAddress: async (req, res) => {
        try {
            const userId = req.session.user;
            const {
                name,
                addressType,
                city,
                state,
                landMark,
                pincode,
                phone,
                altPhone
            } = req.body;


            let addressDoc = await Address.findOne({ userId });

            if (addressDoc) {
                addressDoc.address.push({
                    name,
                    addressType,
                    city,
                    state,
                    landMark,
                    pincode,
                    phone,
                    altPhone
                });
                await addressDoc.save();
            } else {
                addressDoc = new Address({
                    userId,
                    address: [{
                        name,
                        addressType,
                        city,
                        state,
                        landMark,
                        pincode,
                        phone,
                        altPhone
                    }]
                });
                await addressDoc.save();
            }

            res.redirect('/checkout');




        } catch (error) {

            console.log("error in addCheckoutAddress", error);
            res.status(500).json({ error: "Internal server error" });

        }
    },
    placeOrder: async (req, res) => {
        try {
            const userId = req.session.user;
            const { shippingAddress, paymentMethod, totalAmount, couponCode, discountAmount } = req.body;

            // Validate totalAmount
            if (totalAmount < 0) {
                return res.status(400).json({
                    success: false,
                    error: "Some products are not available and have been removed from your cart."
                });
            }

            // Validate address
            const address = await Address.findOne({
                userId,
                "address._id": shippingAddress,
            });

            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid shipping address"
                });
            }

            const orderAddress = address.address.find(
                addr => addr._id.toString() === shippingAddress
            );

            const orderedItems = JSON.parse(JSON.stringify(req.body.orderedItems));
            const unavailableItems = [];

            // Check product availability
            for (const item of orderedItems) {
                const productId = item.productId;
                console.log("🔍 Checking productId:", productId);

                const product = await Product.findById(productId).populate("category");
                console.log("📦 Found product:", product ? product.productName : "❌ Not found");

                if (!product || product.isBlocked) {
                    console.log("❌ Blocked or Not Found:", productId);
                    unavailableItems.push({
                        id: productId,
                        name: "Unknown product",
                        reason: "Product is no longer available"
                    });
                    continue;
                }

                if (!product.category || !product.category.isListed) {
                    console.log("❌ Category Unlisted or Missing for:", product.productName);
                    unavailableItems.push({
                        id: productId,
                        name: product.productName,
                        reason: "Product category is no longer available"
                    });
                    continue;
                }

                if (product.quantity < item.quantity) {
                    console.log("❌ Not enough stock for:", product.productName);
                    unavailableItems.push({
                        id: productId,
                        name: product.productName,
                        reason: "Insufficient stock available"
                    });
                }
            }



            if (unavailableItems.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: "Some products have become unavailable since you added them to your cart",
                    unavailableItems
                });
            }

            let coupon = "";
            let isReferralCoupon = false;
            if (couponCode) {
                // First check if it's a regular coupon
                coupon = await Coupon.findOne({ couponCode: couponCode });

                // If not a regular coupon, check if it's a referral coupon
                if (!coupon) {
                    const referralValidation = await validateReferralCoupon(userId, couponCode);
                    if (!referralValidation.valid) {
                        return res.status(400).json({ success: false, error: "Invalid coupon code" });
                    }
                    isReferralCoupon = true;
                    coupon = referralValidation.coupon;
                }
            }

            const cleanedTotal = parseFloat(totalAmount);
            const cleanedDiscount = parseFloat(discountAmount)

            if (isNaN(cleanedTotal)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid total amount"
                });
            }

            if (!userId || !shippingAddress || !paymentMethod || !totalAmount || !orderedItems) {
                return res.status(400).json({
                    success: false,
                    error: "Please fill all the fields"
                });
            }

            // ✅ COD RESTRICTION VALIDATION
            if (paymentMethod === "cod" && cleanedTotal > 1000) {
                return res.status(400).json({
                    success: false,
                    error: `COD is not available for orders above ₹1000. Your order total: ₹${cleanedTotal}. Please choose online payment or wallet.`
                });
            }

            // ✅ WALLET PAYMENT VALIDATION
            if (paymentMethod === "wallet") {
                const wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                    return res.status(400).json({ success: false, error: "Wallet not found" });
                }

                if (wallet.balance < cleanedTotal) {
                    return res.status(400).json({
                        success: false,
                        error: `Insufficient wallet balance. Your balance: ₹${wallet.balance}, Required: ₹${cleanedTotal}`
                    });
                }
            }

            // Re-confirm product data from DB
            const orderedItemsWithDetails = await Promise.all(
                orderedItems.map(async (item) => {
                    const product = await Product.findById(item.productId).populate('category');

                    if (!product) {
                        throw new Error(`Product not found for ID: ${item.productId}`);
                    }

                    // ✅ Calculate the actual discounted price (same as what customer pays)
                    const discountedProduct = getDiscountPrice(product);
                    const actualPrice = discountedProduct ? discountedProduct.finalPrice : product.salePrice;
                    const appliedOffer = discountedProduct ? discountedProduct.appliedOffer : 0;
                    const appliedOfferType = discountedProduct ? discountedProduct.appliedOfferType : null;

                    return {
                        productId: product._id,
                        quantity: item.quantity,
                        price: actualPrice, // ✅ Store the discounted price, not original price
                        originalPrice: product.salePrice, // ✅ Keep original price for reference
                        productName: product.productName,
                        appliedOffer: appliedOffer, // ✅ Store offer percentage
                        appliedOfferType: appliedOfferType // ✅ Store offer type (product/category)
                    };
                })
            );

            const formattedItems = orderedItemsWithDetails.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price, // ✅ This is now the discounted price
                originalPrice: item.originalPrice, // ✅ Store original price for reference
                productName: item.productName,
                appliedOffer: item.appliedOffer, // ✅ Store offer percentage
                appliedOfferType: item.appliedOfferType // ✅ Store offer type
            }));




            // Create new order
            const newOrder = new Order({

                user_id: userId,
                address_id: shippingAddress,
                shippingAddress: {
                    addressType: orderAddress.addressType,
                    name: orderAddress.name,
                    city: orderAddress.city,
                    landMark: orderAddress.landMark,
                    state: orderAddress.state,
                    pincode: orderAddress.pincode,
                    phone: orderAddress.phone,
                    altPhone: orderAddress.altPhone
                },
                payment_method: paymentMethod,
                finalAmount: cleanedTotal,
                order_items: formattedItems,
                status: "pending",
                total: cleanedTotal,
                couponCode: couponCode || null,
                coupenApplied: !!coupon,
                discount: cleanedDiscount,
                isReferralCoupon: isReferralCoupon || false
            });

            if (isReferralCoupon && couponCode) {
                // Mark referral coupon as used
                await markReferralCouponAsUsed(couponCode, newOrder._id);
                console.log("✅ Referral coupon marked as used:", couponCode);
            } else if (coupon && !isReferralCoupon) {
                // Update regular coupon usage
                await Coupon.findOneAndUpdate(
                    { couponCode },
                    { $inc: { usageCount: 1 } }
                );
            }

            await newOrder.save();

            // ✅ WALLET PAYMENT PROCESSING
            if (paymentMethod === "wallet") {
                // Deduct amount from wallet and add transaction
                const wallet = await Wallet.findOne({ userId });
                if (wallet) {
                    wallet.balance -= cleanedTotal;
                    wallet.transactions.push({
                        type: 'debit',
                        amount: cleanedTotal,
                        description: `Order payment - ${newOrder.orderId}`,
                        status: 'completed'
                    });
                    await wallet.save();
                }

                console.log(`✅ Wallet payment successful. Deducted ₹${cleanedTotal} from wallet. New balance: ₹${wallet.balance}`);
            }

            // Reduce stock
            for (const item of formattedItems) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { quantity: -item.quantity } }
                );
            }

            // Clear cart
            await Cart.findOneAndUpdate(
                { userId },
                { $set: { items: [] } }
            );

            return res.status(200).json({
                success: true,
                orderId: newOrder.orderId,
                message: "Order placed successfully"
            });

        } catch (error) {
            console.error("Order placement error:", error);
            res.status(500).json({
                success: false,
                error: "Failed to place order. Please try again."
            });
        }
    },
    viewOrder: async (req, res) => {
        try {
            const userId = req.session.user;
            const orderId = req.params.id;

            if (!orderId || !userId) {
                console.warn("Missing order ID or user session.");
                return res.redirect('/profile');
            }

            const order = await Order.findById(orderId).populate({
                path: "order_items.productId",
                select: "productName productImage price regularPrice salePrice"
            });

            if (!order) {
                console.warn("Order not found.");
                return res.redirect('/userProfile');
            }

            if (!order.user_id || order.user_id.toString() !== userId.toString()) {
                console.warn("Unauthorized access to order.");
                return res.redirect('/profile');
            }

            // ✅ NEW: Calculate offer savings for each order item
            const orderObject = order.toObject();

            // Calculate savings for each item
            if (orderObject.order_items) {
                orderObject.order_items = orderObject.order_items.map(item => {
                    if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
                        const regularPrice = item.productId.regularPrice;
                        const salePrice = item.productId.salePrice;
                        const savingsPerItem = regularPrice - salePrice;
                        const totalSavingsForItem = savingsPerItem * item.quantity;
                        const offerPercentage = ((savingsPerItem / regularPrice) * 100).toFixed(0);

                        return {
                            ...item,
                            offerSavings: totalSavingsForItem,
                            offerPercentage: offerPercentage,
                            hasOffer: savingsPerItem > 0,
                            savingsPerItem: savingsPerItem
                        };
                    }
                    return {
                        ...item,
                        offerSavings: 0,
                        offerPercentage: 0,
                        hasOffer: false,
                        savingsPerItem: 0
                    };
                });
            }

            const orderData = {
                ...orderObject,
                address: order.shippingAddress || null,
                totalAmount: order.finalAmount || order.total || 0,
                orderStatus: order.status
            };

            console.log("order : ", orderData);


            return res.render("user/order", {
                order: orderData,
                user: req.session.userData
            });

        } catch (error) {
            console.error("❌ viewOrder Error:", error);
            return res.redirect('/profile');
        }
    },
    cancelOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const userId = req.session.user;
            const orderReason = req.body.reason;


            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorised' });
            }

            const order = await Order.findById(orderId);

            if (!orderReason) {
                return res.status(400).json({ success: false, message: 'Reason is required' });
            }
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            for (let item of order.order_items) {
                const updatedProduct = await Product.findByIdAndUpdate(item.productId,
                    { $inc: { quantity: item.quantity } },
                    { new: true }
                )
            }

            order.status = 'cancelled';
            await order.save();

            let wallet = await Wallet.findOne({ userId })
            if (!wallet) {
                wallet = new Wallet({
                    userId,
                    balance: 0,
                    transactions: []
                })
            }
            console.log("Paymentmethod", order.payment_method)
            console.log("Status", order.status)

            if (order.payment_method !== "cod" && order.status === "cancelled") {
                wallet.balance += order.total;
                wallet.transactions.push({
                    type: 'credit',
                    amount: order.total,
                    description: "Refund for cancelled order",
                    status: 'completed'
                });

                await wallet.save();
            }




            return res.status(200).json({ success: true, message: 'Order cancelled successfully' });


        } catch (error) {
            console.error('Error cancelling order:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    },

    generateInvoice: async (req, res) => {
        try {
            const orderId = req.params.id;
            if (!orderId) return res.status(400).send('Invalid Order ID');

            const order = await Order.findById(orderId)
                .populate({
                    path: 'order_items.productId',
                    select: 'name price'
                })
                .populate('user_id', 'name email mobile');

            if (!order) return res.status(404).send('Order not found');

            const invoiceDir = path.join(__dirname, '../../publics/invoices');
            if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

            const invoicePath = path.join(invoiceDir, `invoice-${orderId}.pdf`);
            const writeStream = fs.createWriteStream(invoicePath);
            const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });

            doc.pipe(writeStream);

            // 🧾 Header
            doc.font('Helvetica-Bold').fontSize(25).text('Take Your Time', { align: 'center' })
                .fontSize(16).text('Tax Invoice', { align: 'center' }).moveDown(1.5);

            doc.font('Helvetica').fontSize(10)
                .text(`Invoice Number: ${order._id}`)
                .text(`Date of Issue: ${order.createdAt.toLocaleDateString()}`).moveDown(1);

            // 🧍 Billing Info
            const customerName = order.user_id?.name || 'Customer';
            doc.font('Helvetica-Bold').text('Billing Details:').moveDown(0.5)
                .font('Helvetica').text(`Customer Name: ${customerName}`).moveDown(1);

            // 💳 Payment Info
            doc.font('Helvetica-Bold').text('Payment Details:').moveDown(0.5)
                .font('Helvetica').text(`Payment Method: ${order.payment_method}`)
                .text(`Payment Status: ${order.status}`).moveDown(1);

            // 📦 Order Items Table with Offer Details
            doc.font('Helvetica-Bold').fontSize(12).text('Order Summary');
            const startX = 50;
            const columnWidths = { product: 200, quantity: 60, originalPrice: 80, discount: 80, finalPrice: 80, total: 80 };
            let y = doc.y + 10;

            doc.font('Helvetica-Bold').fontSize(9)
                .text('Product', startX, y, { width: columnWidths.product })
                .text('Qty', startX + columnWidths.product, y, { width: columnWidths.quantity, align: 'center' })
                .text('Original Price', startX + columnWidths.product + columnWidths.quantity, y, { width: columnWidths.originalPrice, align: 'right' })
                .text('Offer Discount', startX + columnWidths.product + columnWidths.quantity + columnWidths.originalPrice, y, { width: columnWidths.discount, align: 'right' })
                .text('Final Price', startX + columnWidths.product + columnWidths.quantity + columnWidths.originalPrice + columnWidths.discount, y, { width: columnWidths.finalPrice, align: 'right' })
                .text('Total', startX + columnWidths.product + columnWidths.quantity + columnWidths.originalPrice + columnWidths.discount + columnWidths.finalPrice, y, { width: columnWidths.total, align: 'right' })
                .moveDown(0.5)
                .moveTo(startX, doc.y).lineTo(580, doc.y).stroke();

            let runningTotal = 0;
            order.order_items.forEach((item) => {
                y = doc.y + 5;
                const itemTotal = item.price * item.quantity;
                runningTotal += itemTotal;

                // ✅ CALCULATE ORIGINAL PRICE AND DISCOUNT (SMART LOGIC)
                let originalPrice = item.originalPrice || item.price;
                let discountAmount = 0;

                // Smart calculation for both old and new orders
                if (item.appliedOffer && item.appliedOffer > 0) {
                    if (originalPrice > item.price) {
                        // New orders: originalPrice is correct
                        discountAmount = originalPrice - item.price;
                    } else {
                        // Old orders: calculate original price from offer percentage
                        originalPrice = item.price / (1 - item.appliedOffer / 100);
                        discountAmount = originalPrice - item.price;
                    }
                }

                // ✅ ENHANCED PRODUCT TEXT WITH PROPER ALIGNMENT
                const productName = item.productName;

                // First, render the product name and all other columns aligned to the same row
                doc.font('Helvetica').fontSize(8)
                    .text(productName, startX, y, { width: columnWidths.product })
                    .text(`${item.quantity}`, startX + columnWidths.product, y, { width: columnWidths.quantity, align: 'center' })
                    .text(`₹${originalPrice.toFixed(0)}`, startX + columnWidths.product + columnWidths.quantity, y, { width: columnWidths.originalPrice, align: 'right' })
                    .text(`-₹${discountAmount.toFixed(0)}`, startX + columnWidths.product + columnWidths.quantity + columnWidths.originalPrice, y, { width: columnWidths.discount, align: 'right' })
                    .text(`₹${item.price.toFixed(0)}`, startX + columnWidths.product + columnWidths.quantity + columnWidths.originalPrice + columnWidths.discount, y, { width: columnWidths.finalPrice, align: 'right' })
                    .text(`₹${itemTotal.toFixed(0)}`, startX + columnWidths.product + columnWidths.quantity + columnWidths.originalPrice + columnWidths.discount + columnWidths.finalPrice, y, { width: columnWidths.total, align: 'right' });

                // Then, add offer details below the product name (if applicable)
                if (item.appliedOffer && item.appliedOffer > 0 && discountAmount > 0) {
                    const offerType = item.appliedOfferType === 'product' ? 'Product' : 'Category';
                    const currentY = doc.y;

                    doc.font('Helvetica').fontSize(7)
                        .text(`Original: ₹${originalPrice.toFixed(0)}`, startX, currentY + 12, { width: columnWidths.product })
                        .text(`${offerType} Offer`, startX, currentY + 24, { width: columnWidths.product })
                        .text(`You saved ₹${discountAmount.toFixed(0)} (${item.appliedOffer}% off)`, startX, currentY + 36, { width: columnWidths.product });

                    doc.moveDown(1.8); // Extra space for offer details
                } else {
                    doc.moveDown(0.5); // Normal spacing for products without offers
                }
            });

            doc.moveDown(1).moveTo(startX, doc.y).lineTo(580, doc.y).stroke().moveDown(0.5);

            // 📋 Order Totals
            const summaryY = doc.y;
            const lineHeight = 15;
            const subtotal = order.total || runningTotal;
            const discount = order.discount || 0;
            const deliveryCharge = 40;
            const grandTotal = order.finalAmount || (subtotal - discount + deliveryCharge);

            doc.font('Helvetica-Bold').text('Subtotal', 400, summaryY, { width: 100, align: 'right' });
            doc.font('Helvetica').text(`₹${subtotal.toFixed(2)}`, 500, summaryY, { width: 50, align: 'right' });

            doc.font('Helvetica-Bold').text('Coupon Discount', 400, summaryY + lineHeight, { width: 100, align: 'right' });
            doc.font('Helvetica').text(`₹${discount.toFixed(2)}`, 500, summaryY + lineHeight, { width: 50, align: 'right' });

            doc.font('Helvetica-Bold').text('Delivery Charge', 400, summaryY + lineHeight * 2, { width: 100, align: 'right' });
            doc.font('Helvetica').text(`₹${deliveryCharge.toFixed(2)}`, 500, summaryY + lineHeight * 2, { width: 50, align: 'right' });

            doc.font('Helvetica-Bold').text('Grand Total', 400, summaryY + lineHeight * 3, { width: 100, align: 'right' });
            doc.font('Helvetica-Bold').text(`₹${grandTotal.toFixed(2)}`, 500, summaryY + lineHeight * 3, { width: 50, align: 'right' });

            // 🏷️ Show applied coupons (both regular and referral)
            if (order.coupenApplied && order.couponCode) {
                doc.moveDown(1);

                // Check if it's a referral coupon (use saved field or fallback to code prefix)
                const isReferralCoupon = order.isReferralCoupon || order.couponCode.startsWith('REF');

                if (isReferralCoupon) {
                    doc.font('Helvetica-Bold').fontSize(12).text('🎁 Referral Coupon Applied:', 50)
                        .font('Helvetica').fontSize(11).text(`Code: ${order.couponCode}`, 50)
                        .text(`Discount: ₹${order.discount}`, 50)
                        .font('Helvetica').fontSize(9).fillColor('#28a745')
                        .text('🎉 Referral Reward - Thank you for referring friends to Take Your Time!', 50)
                        .fillColor('black');
                } else {
                    doc.font('Helvetica-Bold').fontSize(12).text('💳 Coupon Applied:', 50)
                        .font('Helvetica').fontSize(11).text(`Code: ${order.couponCode}`, 50)
                        .text(`Discount: ₹${order.discount}`, 50);
                }
            }

            // 🎉 Footer
            doc.moveDown(3)
                .font('Helvetica').text('Thanks for choosing Timeless Aura', { width: 550, align: 'center' })
                .text('Return Policy: www.timelessaura.com/return-policy', { width: 550, align: 'center' })
                .moveDown(1).font('Helvetica-Bold').text('Contact Us: 7994102605', { width: 550, align: 'center' })
                .text('Email: contact@timelessaura.com', { width: 550, align: 'center' })
                .moveDown(1).font('Helvetica').text('Visit Us: www.timelessaura.com', { width: 550, align: 'center' });

            doc.end();

            writeStream.on('finish', () => {
                res.download(invoicePath, `invoice-${orderId}.pdf`, (err) => {
                    if (err) {
                        console.error('Download error:', err);
                        res.status(500).send('Error downloading invoice');
                    }
                });
            });

        } catch (error) {
            console.error('Invoice Generation Error:', error);
            res.status(500).send('Error generating invoice');
        }
    },

    returnOrder: async (req, res) => {
        try {
            const { reason } = req.body;
            const userId = req.session.user;
            const orderId = req.params.orderId;

            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            if (!reason) {
                return res.status(400).json({ success: false, message: 'Return reason is required' });
            }

            const order = await Order.findById(orderId);
            if (!order || order.status !== "delivered") {
                return res.status(404).json({ success: false, message: 'invalid Order' });
            }

            if (order.status !== "delivered") {
                return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
            }

            // ✅ Only change status of items that are currently "active"
            let hasActiveItems = false;
            for (let item of order.order_items) {
                if (item.status === "active") {
                    item.status = "return requested";
                    item.return_reason = reason;
                    item.returned_at = new Date();
                    hasActiveItems = true;
                }
            }

            if (!hasActiveItems) {
                return res.status(400).json({ success: false, message: 'No active items found to return' });
            }

            // ✅ Check if all items are now returned/cancelled, then update order status
            const allItemsReturned = order.order_items.every(item =>
                item.status === "return requested" ||
                item.status === "returned" ||
                item.status === "cancelled"
            );

            if (allItemsReturned) {
                order.status = 'Return requested';
                order.returnReason = reason;
            }

            await order.save();

            return res.status(200).json({ success: true, message: 'Return request submitted successfully for active items' })




        } catch (error) {
            console.log("error in return order", error)
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },

    cancelOrderItem: async (req, res) => {
        try {
            const { reason, quantity } = req.body; // ⬅️ accept quantity from frontend
            const { orderId, productId } = req.params;

            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            if (!reason || !quantity || quantity < 1) {
                return res.status(400).json({ success: false, message: 'Reason and valid quantity are required' });
            }

            const item = order.order_items.find(item => item.productId.toString() === productId);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found in order' });
            }

            if (quantity > item.quantity) {
                return res.status(400).json({ success: false, message: 'Quantity exceeds ordered amount' });
            }

            // Update product stock
            await Product.findByIdAndUpdate(productId, {
                $inc: { quantity: quantity }
            });

            const userId = order.user_id;

            // Handle refund if payment is not COD
            if (order.payment_method !== 'cod') {
                const refundAmount = item.price * quantity;
                let wallet = await Wallet.findOne({ userId });

                if (!wallet) {
                    wallet = new Wallet({
                        userId,
                        balance: 0,
                        transactions: []
                    });
                }

                wallet.balance += refundAmount;
                wallet.transactions.push({
                    type: 'credit',
                    amount: refundAmount,
                    description: `Refund for cancelled quantity of ${item.productName}`,
                    status: 'completed'
                });

                await wallet.save();
            }

            if (quantity === item.quantity) {
                // Full cancellation
                item.status = 'cancelled';
                item.cancel_reason = reason;
                item.cancelled_at = new Date();
                item.cancelled_quantity = quantity; // Store cancelled quantity
                item.quantity = 0; // Set quantity to zero to reflect full cancel
            } else {
                // Partial cancellation
                item.quantity -= quantity; // Reduce ordered quantity
                item.cancelled_quantity = (item.cancelled_quantity || 0) + quantity;
                item.cancel_reason = reason;
                item.cancelled_at = new Date();

                // Keep status as 'placed' since part is still active
            }


            // Recalculate order total and final amount
            // Recalculate order total and final amount with delivery charge logic
            let newTotal = 0;
            let hasActiveItems = false;

            order.order_items.forEach(i => {
                if (i.status !== 'cancelled' && i.quantity > 0) {
                    newTotal += i.price * i.quantity;
                    hasActiveItems = true;
                }
            });

            order.total = newTotal;

            const DELIVERY_CHARGE = 40;
            order.finalAmount = newTotal - (order.discount || 0) + (hasActiveItems ? DELIVERY_CHARGE : 0);


            await order.save();

            return res.status(200).json({
                success: true,
                message: `Cancelled ${quantity} ${quantity > 1 ? 'items' : 'item'} successfully`
            });

        } catch (error) {
            console.error("Error cancelling order item:", error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },



    returnOrderItem: async (req, res) => {
        try {
            const { reason, quantity } = req.body; // ✅ Accept quantity from frontend
            const { orderId, productId } = req.params;

            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            if (!reason || !quantity || quantity < 1) {
                return res.status(400).json({ success: false, message: 'Reason and valid quantity are required' });
            }

            const item = order.order_items.find(
                (i) => i.productId.toString() === productId && i.status === "active"
            );

            if (!item) {
                return res.status(404).json({ success: false, message: "Item not found or already returned/cancelled" });
            }

            if (quantity > item.quantity) {
                return res.status(400).json({ success: false, message: 'Return quantity exceeds available quantity' });
            }

            if (order.status !== "delivered") {
                return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
            }

            // ✅ Handle partial quantity returns (similar to cancel logic)
            if (quantity < item.quantity) {
                // Reduce the original item quantity
                item.quantity -= quantity;

                // Create a new item entry for the returned quantity
                const returnedItem = {
                    productId: item.productId,
                    quantity: quantity,
                    price: item.price,
                    originalPrice: item.originalPrice || item.price,
                    productName: item.productName,
                    status: 'return requested',
                    return_reason: reason,
                    returned_at: new Date()
                };

                order.order_items.push(returnedItem);
            } else {
                // ✅ Return entire quantity - change status of existing item
                item.set('status', 'return requested');
                item.set('return_reason', reason);
                item.set('returned_at', new Date());
            }

            // ✅ Recalculate order totals
            let newTotal = 0;
            let hasActiveItems = false;

            order.order_items.forEach(orderItem => {
                if (orderItem.status === 'active') {
                    newTotal += orderItem.price * orderItem.quantity;
                    hasActiveItems = true;
                }
            });

            order.total = newTotal;

            const DELIVERY_CHARGE = 40;
            order.finalAmount = newTotal - (order.discount || 0) + (hasActiveItems ? DELIVERY_CHARGE : 0);

            order.markModified('order_items');
            await order.save();

            return res.status(200).json({
                success: true,
                message: `Return request submitted for ${quantity} ${quantity > 1 ? 'items' : 'item'}`
            });

        } catch (error) {
            console.error("Return item error:", error);
            return res.status(500).json({ success: false, message: "Server error" });
        }
    },




    validateCheckoutItems: async (req, res) => {

        try {
            const { orderedItems } = req.body;
            console.log("ordered items in : ", orderedItems)

            const unavailableItems = [];

            for (const item of orderedItems) {
                const product = await Product.findById(item.productId).populate("category");

                if (!product || product.isBlocked) {
                    unavailableItems.push({
                        id: item.productId,
                        name: item.productName || "Unknown product",
                        reason: "Product is no longer available"
                    });
                    continue;
                }


                if (!product.category || !product.category.isListed) {
                    unavailableItems.push({
                        id: item.productId,
                        name: product.productName,
                        reason: "Product category is no longer available"
                    });
                    continue;
                }

                if (product.quantity < item.quantity) {
                    unavailableItems.push({
                        id: item.productId,
                        name: product.productName,
                        reason: "Insufficient stock available"
                    });
                }



            }

            if (unavailableItems.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: "Some products have become unavailable",
                    unavailableItems: unavailableItems
                });
            }

            return res.json({
                success: true,
                message: "All products are available"
            });


        } catch (error) {

            console.error("Error validating checkout items:", error);
            return res.status(500).json({
                success: false,
                error: "Failed to validate items. Please try again."
            });

        }

    },

    applyCoupon: async (req, res) => {
        try {
            const { couponCode, subtotal } = req.body;
            const userId = req.session.user;

            // First check if it's a regular coupon
            const coupon = await Coupon.findOne({ couponCode, isActive: true });

            // If not a regular coupon, check if it's a referral coupon
            if (!coupon) {
                const referralValidation = await validateReferralCoupon(userId, couponCode);
                if (!referralValidation.valid) {
                    return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
                }

                // Handle referral coupon
                const discount = referralValidation.discount; // ₹100
                const newTotal = subtotal - discount;

                // For referral coupons, don't modify any usage count here
                // Only mark as used when order is actually placed
                return res.status(200).json({
                    success: true,
                    message: 'Referral coupon applied successfully',
                    discount,
                    newTotal,
                    isReferralCoupon: true
                });
            }

            // Handle regular coupons
            const currentDate = new Date();
            if (coupon.couponValidity < currentDate) {
                return res.status(400).json({ success: false, message: 'Coupon has expired' });
            }
            if (coupon.limit <= 0) {
                return res.status(400).json({ success: false, message: 'Coupon has reached its limit' });
            }

            let discount = 0;
            if (coupon.couponType === "percentage") {
                discount = (subtotal * coupon.couponDiscount) / 100;
            } else {
                discount = coupon.couponDiscount;
            }

            if (discount > coupon.couponMaxAmount) {
                discount = coupon.couponMaxAmount;
            }

            let newTotal = subtotal - discount;

            coupon.limit -= 1;
            coupon.usageCount += 1;
            await coupon.save();

            return res.status(200).json({ success: true, message: 'Coupon applied successfully', discount, newTotal });

        } catch (error) {

            console.log("error applying coupon", error)
            return res.status(500).json({ success: false, message: 'Internal server error' });

        }
    },

    removeCoupon: async (req, res) => {
        try {
            const { couponCode, subtotal } = req.body;
            const userId = req.session.user;

            // First check if it's a regular coupon
            const coupon = await Coupon.findOne({ couponCode: couponCode });

            if (!coupon) {
                // Check if it's a referral coupon
                const referralValidation = await validateReferralCoupon(userId, couponCode);
                if (!referralValidation.valid) {
                    return res.json({ success: false, message: 'Invalid coupon' });
                }

                // For referral coupons, just return success (no usage count to revert)
                return res.json({
                    success: true,
                    cartTotal: subtotal,
                    message: 'Referral coupon removed successfully'
                });
            }

            // Handle regular coupon removal
            coupon.limit += 1;
            coupon.usageCount -= 1;
            await coupon.save();

            res.json({
                success: true,
                cartTotal: subtotal,
                message: 'Coupon removed successfully'
            });

        } catch (error) {
            console.error("Error removing coupon:", error);
            res.status(500).json({
                success: false,
                message: 'Server error while removing coupon'
            });
        }
    }






}