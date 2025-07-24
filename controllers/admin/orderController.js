const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const { Admin } = require("mongodb");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const fs = require("fs");
const path = require("path");
const { Console } = require("console");



module.exports = {

    getOrderPage: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1
            const limit = 5
            const skip = (page - 1) * limit
            const count = await Order.countDocuments()
            const totalPages = Math.ceil(count / limit)


            const orders = await Order.find({ status: { $nin: ["failed"] } })
                .populate("user_id", "name email mobile")
                .populate("order_items.productId", "productName productImage price")
                .sort({ createdAt: -1 }).skip(skip).limit(limit).lean()


            const returnRequests = orders.filter(order => order.status === 'Return requested')
            console.log("your orders : ", orders)
            console.log("return : requests", returnRequests)

            // Extract item-level return requests
            const itemReturnRequests = [];

            orders.forEach(order => {
                order.order_items.forEach(item => {
                    if (item.status === "return requested") {
                        itemReturnRequests.push({
                            orderId: order._id,
                            orderUniqueId: order.orderId,
                            user: order.user_id,
                            return_reason: item.return_reason,
                            product: item.productId,
                            productName: item.productName,
                            status: item.status,
                            returnDate: item.returned_at,
                            productId: item.productId._id
                        });
                    }
                });
            });
            console.log("itemReturnRequests : ", itemReturnRequests)



            res.render('admin/orderMang', {
                admin: true,
                orders,
                returnRequests,
                itemReturnRequests,
                currentPage: page,
                totalPages
            })
        } catch (error) {
            res.status(500).json({ success: false, message: "internal server error" })

        }

    },


    updateOrder: async (req, res) => {
        try {
            const { orderId, status } = req.body
            console.log("Updating order:", orderId, "to status:", status);


            if (!orderId || !status) {
                return res.status(400).json({ success: false, message: "order ID and status are required" })
            }

            const order = await Order.findById(orderId)

            if (!order) {
                return res.status(404).json({ success: false, message: "order not found" })
            }

            order.status = status
            if (status === 'cancelled') {
                for (const item of order.order_items) {
                    const product = await Product.findById(item.productId)
                    if (product) {
                        product.quantity += item.quantity
                        await product.save()
                    }
                }
            }

            await order.save()

            res.status(200).json({ success: true, message: "order updated successfully", status: order.status })


        } catch (error) {

            console.log("error updating order", error)
            res.status(500).json({ success: false, message: "internal server error" })

        }
    },
    cancelOrder: async (req, res) => {

        try {
            const { orderId } = req.body

            if (!orderId) {
                return res.status(404).json({ success: false, message: "order not found" })
            }

            const order = await Order.findById(orderId)

            if (!order) {
                return res.status(404).json({ success: false, message: "order not found" })
            }

            order.status = 'cancelled'

            for (const item of order.order_items) {
                const product = await Product.findById(item.productId)
                if (product) {
                    product.quantity += item.quantity
                    await product.save()
                }
            }

            await order.save()

            res.status(200).json({ success: true, message: "order cancelled successfully" })


        } catch (error) {
            console.log("error cancelling order", error)
            res.status(500).json({ success: false, message: "internal server error" })
        }

    },

    approveReturn: async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const order = await Order.findById(orderId);
    if (!order || order.status !== 'Return requested') {
      return res.status(404).json({ success: false, message: "Order not found or not in return requested state" });
    }

    const userId = order.user_id;
    let totalRefund = 0;

    for (let item of order.order_items) {
      // ✅ Only update items that are in return requested state
      if (item.status === 'return requested') {
        item.status = 'returned';
        item.returned_at = new Date();

        // ✅ Restock
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: item.quantity }
        });

        // ✅ Refund for this item
        totalRefund += item.price * item.quantity;
      }
    }

    // ✅ Update order status
    order.status = 'Return approved';
    order.adminReturnStatus = 'approved';
    order.markModified('order_items');
    await order.save();

    // ✅ Refund to wallet
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        transactions: []
      });
    }

    wallet.balance += totalRefund;
    wallet.transactions.push({
      type: 'credit',
      amount: totalRefund,
      description: `Refund for approved return of order (${order.orderId})`,
      status: 'completed'
    });

    await wallet.save();

    return res.status(200).json({ success: true, message: "Return approved and refunded successfully." });

  } catch (error) {
    console.error("Error approving return:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
},

    rejectReturn: async (req, res) => {
        try {
            const { reason } = req.body
            const orderId = req.params.orderId

            console.log("Rejecting return with reason:", reason);
            console.log("Order ID:", orderId);

            if (!orderId) {
                return res.status(404).json({ success: false, message: "order not found" })
            }


            const order = await Order.findById(orderId)


            if (!order) {
                return res.status(404).json({ success: false, message: "order not found" })
            }


            order.status = "Return rejected"
            order.adminReturnStatus = reason

            await order.save()

            res.status(200).json({ success: true, message: "Return rejected" })


        } catch (error) {

            console.log("error rejecting return", error)
            res.status(500).json({ success: false, message: "internal server error" })

        }
    },



   approveItemReturn: async (req, res) => {
  try {
    const { orderId, productId } = req.body;

    if (!orderId || !productId) {
      return res.status(400).json({ success: false, message: "Missing orderId or productId" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ✅ Find the correct return-requested item
    const item = order.order_items.find(
      (i) => i.productId.toString() === productId && i.status === 'return requested'
    );

    if (!item) {
      return res.status(400).json({ success: false, message: "Item not eligible for return" });
    }

    // ✅ Update product stock based on returned quantity
    await Product.findByIdAndUpdate(productId, {
      $inc: { quantity: item.quantity } // quantity of returned units
    });

    // ✅ Mark item as returned
    item.status = 'returned';
    item.returned_at = new Date();

    await order.save();

    // ✅ Refund to wallet
    const userId = order.user_id;
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        transactions: []
      });
    }

    const refundAmount = item.price * item.quantity;

    wallet.balance += refundAmount;
    wallet.transactions.push({
      type: 'credit',
      amount: refundAmount,
      description: `Refund for returned item (${item.productName})`,
      status: 'completed',
      createdAt: new Date()
    });

    await wallet.save();

    return res.status(200).json({ success: true, message: "Item return approved" });

  } catch (error) {
    console.error("Error approving item return", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
},


    rejectItemReturn: async (req, res) => {


        try {
            const { orderId, productId, reason } = req.body;

            console.log("Rejecting item return: ", { orderId, productId, reason });

            if (!orderId || !productId || !reason) {
                return res.status(400).json({ success: false, message: "Missing required data" });
            }

            const order = await Order.findById(orderId);

            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            // Find the item in order_items
            const item = order.order_items.find(item =>
                item.productId.toString() === productId.toString() &&
                item.status === 'return requested'
            );

            if (!item) {
                return res.status(404).json({ success: false, message: "Item with return request not found" });
            }

            item.status = "return rejected";
            item.return_reason = reason;
            item.returned_at = new Date();

            await order.save();

            return res.status(200).json({ success: true, message: "Item return rejected successfully" });

        } catch (error) {
            console.error("Error in rejectItemReturn:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    },

    getSalesReport: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const skip = (page - 1) * limit;

            const filterType = req.query.filterType || 'All';
            const fromDate = req.query.fromDate;
            const toDate = req.query.toDate;

            console.log(filterType, fromDate, toDate);

            const dateRange = getDateRange(filterType, fromDate, toDate);

            console.log("dateRange:", dateRange);

            const query = {
                status: { $in: ["delivered", "Return rejected"] },
                createdAt: { $gte: dateRange.start, $lte: dateRange.end }
            };

            const totalOrders = await Order.countDocuments(query);

            console.log(totalOrders);


            const totalSales = await Order.find(query)
                .select('total')
                .then(orders => orders.reduce((sum, order) => sum + order.total, 0));

            console.log("total sales : ", totalSales);

            const totalPages = Math.ceil(totalOrders / limit);

            const orders = await Order.find(query)
                .populate('user_id', 'name email mobile')
                .populate('order_items.productId', 'productName price regularPrice salePrice')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit).lean();

            // ✅ NEW: Calculate offer savings for each order
            let totalOfferSavingsAllOrders = 0;

            for (let order of orders) {
                let totalOfferSavings = 0;

                for (let item of order.order_items) {
                    if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
                        const regularPrice = item.productId.regularPrice;
                        const salePrice = item.productId.salePrice;
                        const savingsPerItem = regularPrice - salePrice;
                        const totalSavingsForItem = savingsPerItem * item.quantity;
                        totalOfferSavings += totalSavingsForItem;
                    }
                }

                // Add to order object
                order.offerSavings = totalOfferSavings;
                order.totalSavings = totalOfferSavings + (order.discount || 0);

                // Add to total across all orders
                totalOfferSavingsAllOrders += totalOfferSavings;
            }

            console.log("orders : ", orders);

            // ✅ NEW: Calculate coupon usage statistics
            let totalCouponsUsed = 0;
            let adminCouponsUsed = 0;
            let referralCouponsUsed = 0;
            let totalCouponSavings = 0;
            let totalReferralSavings = 0;
            let totalAllCouponSavings = 0;
            let allTopCoupons = [];

            try {
                const Referral = require("../../models/referralSchema");

                // Count admin coupons used (orders with coupons applied, excluding "false")
                adminCouponsUsed = await Order.countDocuments({
                    ...query,
                    coupenApplied: { $ne: "false" }
                });

                // Count referral coupons used
                referralCouponsUsed = await Referral.countDocuments({
                    status: "used"
                });

                // Total coupons used
                totalCouponsUsed = adminCouponsUsed + referralCouponsUsed;

                // Calculate total savings from coupons
                const ordersWithCoupons = await Order.find({
                    ...query,
                    coupenApplied: { $ne: "false" }
                });

                totalCouponSavings = ordersWithCoupons.reduce((sum, order) => {
                    return sum + (order.discount || 0);
                }, 0);

                // Get referral coupon savings
                const referralSavings = await Referral.aggregate([
                    { $match: { status: "used" } },
                    { $group: { _id: null, total: { $sum: "$discount" } } }
                ]);

                totalReferralSavings = referralSavings.length > 0 ? referralSavings[0].total : 0;
                totalAllCouponSavings = totalCouponSavings + totalReferralSavings;

                // ✅ NEW: Get top used coupons details
                const topAdminCoupons = await Order.aggregate([
                    { $match: { ...query, coupenApplied: { $ne: "false" } } },
                    { $group: {
                        _id: "$coupenApplied",
                        usageCount: { $sum: 1 },
                        totalSavings: { $sum: "$discount" }
                    }},
                    { $sort: { usageCount: -1 } },
                    { $limit: 5 },
                    { $project: {
                        code: "$_id",
                        type: "Admin Coupon",
                        usageCount: 1,
                        totalSavings: 1,
                        _id: 0
                    }}
                ]);

                const topReferralCoupons = await Referral.aggregate([
                    { $match: { status: "used" } },
                    { $group: {
                        _id: "$couponCode",
                        usageCount: { $sum: 1 },
                        totalSavings: { $sum: "$discount" }
                    }},
                    { $sort: { usageCount: -1 } },
                    { $limit: 5 },
                    { $project: {
                        code: "$_id",
                        type: "Referral Coupon",
                        usageCount: 1,
                        totalSavings: 1,
                        _id: 0
                    }}
                ]);

                // Combine and sort all coupons
                allTopCoupons = [...topAdminCoupons, ...topReferralCoupons]
                    .sort((a, b) => b.usageCount - a.usageCount)
                    .slice(0, 10);

            } catch (couponError) {
                console.log("Error calculating coupon analytics:", couponError);
                // Use default values if coupon analytics fail
            }

            res.render("admin/sales", {
                layout: false, // ✅ NO LAYOUT - Standalone page
                orders,
                totalSales,
                totalOrders,
                currentPage: page,
                totalPages,
                filterType,
                fromDate,
                toDate,
                // ✅ NEW: Coupon analytics data
                totalCouponsUsed,
                adminCouponsUsed,
                referralCouponsUsed,
                totalCouponSavings,
                totalReferralSavings,
                totalAllCouponSavings,
                topCoupons: allTopCoupons,
                // ✅ NEW: Total Offer Savings data
                totalOfferSavingsAllOrders
            })
        } catch (error) {

            console.log("Error getting sales report", error);
            res.status(500).json({ success: false, message: "Internal server error" });

        }
    },

    getSalesReportPDF: async (req, res) => {
        try {


            const filterType = req.query.filterType || 'All';
            const fromDate = req.query.fromDate;
            const toDate = req.query.toDate;

            const dateRange = getDateRange(filterType, fromDate, toDate);

            const query = {
                status: { $in: ["delivered", "Return rejected"] },
                createdAt: { $gte: dateRange.start, $lte: dateRange.end }
            };

            const orders = await Order.find(query)
                .populate('user_id', 'name email phone')
                .populate('order_items.productId', 'productName price regularPrice salePrice')
                .sort({ createdAt: -1 });

            console.log(orders);

            const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
            const totalOrders = orders.length;

            // ✅ CALCULATE ALL SUMMARY STATISTICS (Same as sales page)

            // ✅ FIXED: Coupon analytics (using same logic as sales page)
            let totalCouponsUsed = 0;
            let adminCouponsUsed = 0;
            let referralCouponsUsed = 0;
            let totalAllCouponSavings = 0;
            let allTopCoupons = []; // ✅ NEW: For top used coupons in PDF

            try {
                const Referral = require("../../models/referralSchema");

                // Count admin coupons used (orders with coupons applied, excluding "false")
                adminCouponsUsed = await Order.countDocuments({
                    ...query,
                    coupenApplied: { $ne: "false" }
                });

                // Count referral coupons used
                referralCouponsUsed = await Referral.countDocuments({
                    status: "used"
                });

                // Total coupons used
                totalCouponsUsed = adminCouponsUsed + referralCouponsUsed;

                // Calculate total savings from coupons
                const ordersWithCoupons = await Order.find({
                    ...query,
                    coupenApplied: { $ne: "false" }
                });

                const totalCouponSavings = ordersWithCoupons.reduce((sum, order) => {
                    return sum + (order.discount || 0);
                }, 0);

                // Get referral coupon savings
                const referralSavings = await Referral.aggregate([
                    { $match: { status: "used" } },
                    { $group: { _id: null, total: { $sum: "$discount" } } }
                ]);

                const totalReferralSavings = referralSavings.length > 0 ? referralSavings[0].total : 0;
                totalAllCouponSavings = totalCouponSavings + totalReferralSavings;

                // ✅ NEW: Get top used coupons details for PDF
                const topAdminCoupons = await Order.aggregate([
                    { $match: { ...query, coupenApplied: { $ne: "false" } } },
                    { $group: {
                        _id: "$coupenApplied",
                        usageCount: { $sum: 1 },
                        totalSavings: { $sum: "$discount" }
                    }},
                    { $sort: { usageCount: -1 } },
                    { $limit: 5 },
                    { $project: {
                        code: "$_id",
                        type: "Admin Coupon",
                        usageCount: 1,
                        totalSavings: 1,
                        _id: 0
                    }}
                ]);

                const topReferralCoupons = await Referral.aggregate([
                    { $match: { status: "used" } },
                    { $group: {
                        _id: "$couponCode",
                        usageCount: { $sum: 1 },
                        totalSavings: { $sum: "$discount" }
                    }},
                    { $sort: { usageCount: -1 } },
                    { $limit: 5 },
                    { $project: {
                        code: "$_id",
                        type: "Referral Coupon",
                        usageCount: 1,
                        totalSavings: 1,
                        _id: 0
                    }}
                ]);

                // Combine and sort all coupons for PDF
                allTopCoupons = [...topAdminCoupons, ...topReferralCoupons]
                    .sort((a, b) => b.usageCount - a.usageCount)
                    .slice(0, 10);

            } catch (error) {
                console.log("Error calculating coupon statistics:", error);
                // Set defaults if calculation fails
                totalCouponsUsed = 0;
                adminCouponsUsed = 0;
                referralCouponsUsed = 0;
                totalAllCouponSavings = 0;
                allTopCoupons = []; // Default empty array for top coupons
            }

            // ✅ FIXED: Offer savings calculation (matching sales page logic)
            let totalOfferSavingsAllOrders = 0;

            for (let order of orders) {
                let totalOfferSavings = 0;

                for (let item of order.order_items) {
                    if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
                        const regularPrice = item.productId.regularPrice;
                        const salePrice = item.productId.salePrice;
                        const savingsPerItem = regularPrice - salePrice;
                        const totalSavingsForItem = savingsPerItem * item.quantity;
                        totalOfferSavings += totalSavingsForItem;
                    }
                }

                // Add to total across all orders
                totalOfferSavingsAllOrders += totalOfferSavings;
            }




            const doc = new PDFDocument({
                margin: 50,
                size: 'A3',        // ✅ LARGER PAGE SIZE
                layout: 'landscape' // ✅ LANDSCAPE ORIENTATION for more width
            });

            const filePath = path.join(__dirname, '../publics/sales_report.pdf');

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            doc.fontSize(24)
                .font('Helvetica-Bold')
                .text('TAKE YOUR TIME', { align: 'center' })
                .moveDown(0.5);

            doc.fontSize(16)
                .font('Helvetica')
                .text(`Sales Report - ${filterType}`, { align: 'center' })
                .moveDown(0.5);


            if (fromDate && toDate) {
                doc.fontSize(10)
                    .text(`Date Range: ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`, { align: 'center' })
                    .moveDown(0.5);
            } else if (filterType !== 'All') {
                let periodText = "";
                switch (filterType) {
                    case 'Daily':
                        periodText = "Today";
                        break;
                    case 'Weekly':
                        periodText = "This Week (From Sunday)";
                        break;
                    case 'Monthly':
                        periodText = "Current Month";
                        break;
                    case 'Yearly':
                        periodText = "Current Year";
                        break;
                }

                doc.fontSize(10)
                    .text(`Period: ${periodText}`, { align: 'center' })
                    .moveDown(0.5);
            }

            doc.fontSize(10)
                .text(`Generated on: ${new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}`, { align: 'center' })
                .moveDown(1);

            // ✅ CENTERED SUMMARY SECTION (A3 landscape = ~1190px width, center at ~595px)
            const summaryHeight = 160;
            const summaryWidth = 700;
            const pageWidth = 1190; // A3 landscape width
            const summaryStartX = (pageWidth - summaryWidth) / 2; // Center horizontally

            doc.rect(summaryStartX, doc.y, summaryWidth, summaryHeight).stroke();

            const summaryStartY = doc.y + 15;
            const textStartX = summaryStartX + 20; // Padding inside the box

            doc.fontSize(16)
                .text('Summary', textStartX, summaryStartY)
                .fontSize(12)
                .text(`Overall Sales Count: ${totalOrders}`, textStartX, summaryStartY + 30)
                .text(`Overall Sales Amount: ₹${totalSales.toLocaleString()}.00`, textStartX, summaryStartY + 50)
                .text(`Total Coupons Used: ${totalCouponsUsed}`, textStartX, summaryStartY + 70)
                .text(`Admin Coupons: ${adminCouponsUsed}`, textStartX, summaryStartY + 90)
                .text(`Referral Coupons: ${referralCouponsUsed}`, textStartX, summaryStartY + 110)
                .text(`Total Savings Given: ₹${totalAllCouponSavings.toLocaleString()}.00 (Through all coupons)`, textStartX, summaryStartY + 130)
                .text(`Total Offer Savings: ₹${Math.round(totalOfferSavingsAllOrders).toLocaleString()}.00 (Product & category offers)`, textStartX + 350, summaryStartY + 130)
                .moveDown(4);

            const tableTop = doc.y;
            // ✅ CENTERED TABLE (9 columns with better spacing for A3 landscape)
            const tableHeaders = ['Order ID', 'Date', 'Customer', 'Product', 'Status', 'Payment', 'Offer Applied', 'Discount', 'Amount'];
            const columnWidths = [90, 80, 100, 120, 80, 80, 110, 80, 90];
            const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0); // Total table width = 830
            const tableStartX = (pageWidth - tableWidth) / 2; // Center the table horizontally
            let xPosition = tableStartX;

            doc.rect(tableStartX, tableTop, tableWidth, 25).fill('#f0f0f0'); // ✅ CENTERED table header

            doc.font('Helvetica-Bold').fontSize(11); // ✅ LARGER FONT for better readability
            tableHeaders.forEach((header, i) => {
                doc.fillColor('black')
                    .text(header, xPosition, tableTop + 7, { // ✅ Better vertical centering
                        width: columnWidths[i],
                        align: ['Amount', 'Discount'].includes(header) ? 'right' : 'left'
                    });
                xPosition += columnWidths[i];
            });

            doc.font('Helvetica').fontSize(10); // ✅ LARGER FONT for better readability
            let yPosition = tableTop + 30; // ✅ More space after header

            orders.forEach((order, index) => {
                if (yPosition > 750) { // ✅ A3 landscape has more height, but still need pagination
                    doc.addPage();
                    yPosition = 50;

                    xPosition = tableStartX; // ✅ CENTERED on new page
                    doc.rect(tableStartX, yPosition, tableWidth, 25).fill('#f0f0f0'); // ✅ CENTERED header on new page
                    doc.font('Helvetica-Bold').fontSize(11);
                    tableHeaders.forEach((header, i) => {
                        doc.fillColor('black')
                            .text(header, xPosition, yPosition + 7, {
                                width: columnWidths[i],
                                align: ['Amount', 'Discount'].includes(header) ? 'right' : 'left'
                            });
                        xPosition += columnWidths[i];
                    });
                    doc.font('Helvetica').fontSize(10);
                    yPosition += 30;
                }

                if (index % 2 === 0) {
                    doc.rect(tableStartX, yPosition - 5, tableWidth, 25).fill('#f9f9f9'); // ✅ CENTERED alternating row background
                }

                // ✅ ENHANCED TABLE ROWS (9 columns, centered)
                xPosition = tableStartX; // ✅ START from centered position

                // 1. Order ID
                doc.fillColor('black')
                    .text("#" + order.orderId, xPosition, yPosition, {
                        width: columnWidths[0]
                    });

                // 2. Date
                xPosition += columnWidths[0];
                doc.text(new Date(order.createdAt).toLocaleDateString(), xPosition, yPosition, {
                    width: columnWidths[1]
                });

                // 3. Customer Name
                xPosition += columnWidths[1];
                doc.text(order.user_id.name, xPosition, yPosition, {
                    width: columnWidths[2]
                });

                // 4. Product (combine all products with null checks)
                xPosition += columnWidths[2];
                const productNames = order.order_items
                    .filter(item => item.productId && item.productId.productName) // Filter out null/deleted products
                    .map(item => item.productId.productName)
                    .join(', ');
                const truncatedProducts = productNames.length > 25 ? productNames.substring(0, 25) + '...' : // ✅ LONGER TRUNCATION for wider column
                                        productNames.length > 0 ? productNames : 'Deleted Products';
                doc.text(truncatedProducts, xPosition, yPosition, {
                    width: columnWidths[3]
                });

                // 5. Order Status
                xPosition += columnWidths[3];
                doc.text(order.status, xPosition, yPosition, {
                    width: columnWidths[4]
                });

                // 6. Payment Method
                xPosition += columnWidths[4];
                const paymentMethod = order.payment_method === 'cod' ? 'COD' :
                                    order.payment_method === 'razorpay' ? 'Razorpay' :
                                    order.payment_method === 'wallet' ? 'Wallet' :
                                    order.payment_method || 'Unknown';
                doc.text(paymentMethod, xPosition, yPosition, {
                    width: columnWidths[5]
                });

                // 7. Offer Applied (with null checks)
                xPosition += columnWidths[5];
                const offerSavings = order.order_items.reduce((sum, item) => {
                    // Skip items with null/deleted products
                    if (!item.productId || !item.appliedOffer || item.appliedOffer <= 0) {
                        return sum;
                    }

                    let originalPrice = item.originalPrice || item.price;
                    if (originalPrice <= item.price) {
                        originalPrice = item.price / (1 - item.appliedOffer / 100);
                    }
                    return sum + ((originalPrice - item.price) * item.quantity);
                }, 0);

                const offerText = offerSavings > 0 ? `₹${Math.round(offerSavings)} Off` :
                                order.discount > 0 ? `₹${order.discount} Off` : 'No Offer';
                doc.text(offerText, xPosition, yPosition, {
                    width: columnWidths[6]
                });

                // 8. Discount
                xPosition += columnWidths[6];
                doc.text(`₹${order.discount || 0}`, xPosition, yPosition, {
                    width: columnWidths[7],
                    align: 'right'
                });

                // 9. Amount
                xPosition += columnWidths[7];
                const finalAmount = order.finalAmount || order.total;
                doc.text(`₹${finalAmount.toLocaleString()}`, xPosition, yPosition, {
                    width: columnWidths[8],
                    align: 'right'
                });

                yPosition += 25; // ✅ MORE SPACE between rows for better readability
            });

            // ✅ NEW: Add Top Used Coupons Section
            if (allTopCoupons && allTopCoupons.length > 0) {
                // Add some space before the coupon section
                yPosition += 40;

                // Check if we need a new page for the coupon table
                if (yPosition > 650) {
                    doc.addPage();
                    yPosition = 50;
                }

                // Coupon section title
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Top Used Coupons', tableStartX, yPosition, { align: 'left' })
                    .moveDown(1);

                yPosition = doc.y + 10;

                // Coupon table headers
                const couponHeaders = ['Coupon Code', 'Type', 'Usage Count', 'Total Savings'];
                const couponColumnWidths = [200, 150, 120, 150];
                const couponTableWidth = couponColumnWidths.reduce((sum, width) => sum + width, 0);
                const couponTableStartX = (pageWidth - couponTableWidth) / 2;

                // Draw coupon table header
                doc.rect(couponTableStartX, yPosition, couponTableWidth, 25).fill('#e8f4f8');

                let couponXPosition = couponTableStartX;
                doc.font('Helvetica-Bold').fontSize(11);
                couponHeaders.forEach((header, i) => {
                    doc.fillColor('black')
                        .text(header, couponXPosition, yPosition + 7, {
                            width: couponColumnWidths[i],
                            align: ['Usage Count', 'Total Savings'].includes(header) ? 'center' : 'left'
                        });
                    couponXPosition += couponColumnWidths[i];
                });

                doc.font('Helvetica').fontSize(10);
                yPosition += 30;

                // Draw coupon table rows
                allTopCoupons.slice(0, 10).forEach((coupon, index) => {
                    // Check if we need a new page
                    if (yPosition > 750) {
                        doc.addPage();
                        yPosition = 50;

                        // Redraw header on new page
                        doc.rect(couponTableStartX, yPosition, couponTableWidth, 25).fill('#e8f4f8');
                        couponXPosition = couponTableStartX;
                        doc.font('Helvetica-Bold').fontSize(11);
                        couponHeaders.forEach((header, i) => {
                            doc.fillColor('black')
                                .text(header, couponXPosition, yPosition + 7, {
                                    width: couponColumnWidths[i],
                                    align: ['Usage Count', 'Total Savings'].includes(header) ? 'center' : 'left'
                                });
                            couponXPosition += couponColumnWidths[i];
                        });
                        doc.font('Helvetica').fontSize(10);
                        yPosition += 30;
                    }

                    // Alternating row background
                    if (index % 2 === 0) {
                        doc.rect(couponTableStartX, yPosition - 5, couponTableWidth, 25).fill('#f9f9f9');
                    }

                    couponXPosition = couponTableStartX;

                    // Coupon Code
                    doc.fillColor('black')
                        .text(coupon.code || 'N/A', couponXPosition, yPosition, {
                            width: couponColumnWidths[0]
                        });

                    // Type
                    couponXPosition += couponColumnWidths[0];
                    doc.text(coupon.type || 'Unknown', couponXPosition, yPosition, {
                        width: couponColumnWidths[1]
                    });

                    // Usage Count
                    couponXPosition += couponColumnWidths[1];
                    doc.text(coupon.usageCount.toString(), couponXPosition, yPosition, {
                        width: couponColumnWidths[2],
                        align: 'center'
                    });

                    // Total Savings
                    couponXPosition += couponColumnWidths[2];
                    doc.text(`₹${coupon.totalSavings.toLocaleString()}`, couponXPosition, yPosition, {
                        width: couponColumnWidths[3],
                        align: 'center'
                    });

                    yPosition += 25;
                });
            }

            doc.fontSize(10) // ✅ LARGER FOOTER for A3
                .text('© 2025 TAKE YOUR TIME. All rights reserved.', 0, 1000, {
                    align: 'center',
                    width: pageWidth // ✅ FULL PAGE WIDTH for proper centering
                });

            doc.end();

            stream.on('finish', () => {
                res.download(filePath, 'TAKE YOUR TIMEsales_report.pdf', (err) => {
                    if (err) {
                        console.error("Error downloading PDF:", err);
                        res.status(500).send("Error downloading PDF");
                    }
                    fs.unlinkSync(filePath);
                });
            });



        } catch (error) {
            console.log("Error generating sales report PDF", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    },

    getSalesReportExcel: async (req, res) => {
        try {
            const filterType = req.query.filterType || 'All';
            const fromDate = req.query.fromDate;
            const toDate = req.query.toDate;

            const dateRange = getDateRange(filterType, fromDate, toDate);

            const query = {
                status: { $in: ["delivered", "Return rejected"] },
                createdAt: { $gte: dateRange.start, $lte: dateRange.end }
            };

            const orders = await Order.find(query)
                .populate('user_id', 'name email mobile')
                .populate('order_items.productId', 'productName price regularPrice salePrice') // ✅ ADD regularPrice and salePrice
                .sort({ createdAt: -1 });

            console.log("orders in excel : ", orders)

            const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
            const totalOrders = orders.length;

            // ✅ ENHANCED SUMMARY STATISTICS (Same as PDF)
            let totalCouponsUsed = 0;
            let adminCouponsUsed = 0;
            let referralCouponsUsed = 0;
            let totalAllCouponSavings = 0;

            try {
                const Referral = require("../../models/referralSchema");

                // Count admin coupons used
                adminCouponsUsed = await Order.countDocuments({
                    ...query,
                    coupenApplied: { $ne: "false" }
                });

                // Count referral coupons used
                referralCouponsUsed = await Referral.countDocuments({
                    status: "used"
                });

                // Total coupons used
                totalCouponsUsed = adminCouponsUsed + referralCouponsUsed;

                // Calculate total savings from coupons
                const ordersWithCoupons = await Order.find({
                    ...query,
                    coupenApplied: { $ne: "false" }
                });

                const totalCouponSavings = ordersWithCoupons.reduce((sum, order) => {
                    return sum + (order.discount || 0);
                }, 0);

                // Get referral coupon savings
                const referralSavings = await Referral.aggregate([
                    { $match: { status: "used" } },
                    { $group: { _id: null, total: { $sum: "$discount" } } }
                ]);

                const totalReferralSavings = referralSavings.length > 0 ? referralSavings[0].total : 0;
                totalAllCouponSavings = totalCouponSavings + totalReferralSavings;

            } catch (error) {
                console.log("Error calculating coupon statistics:", error);
            }

            // ✅ ENHANCED OFFER SAVINGS CALCULATION (Same as PDF)
            let totalOfferSavingsAllOrders = 0;

            for (let order of orders) {
                let totalOfferSavings = 0;

                for (let item of order.order_items) {
                    if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
                        const regularPrice = item.productId.regularPrice;
                        const salePrice = item.productId.salePrice;
                        const savingsPerItem = regularPrice - salePrice;
                        const totalSavingsForItem = savingsPerItem * item.quantity;
                        totalOfferSavings += totalSavingsForItem;
                    }
                }

                totalOfferSavingsAllOrders += totalOfferSavings;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // ✅ WIDER MERGES for 9 columns
            worksheet.mergeCells('A1:I1');
            worksheet.getCell('A1').value = 'TAKE_YOUR_TIME';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            worksheet.mergeCells('A2:I2');
            worksheet.getCell('A2').value = `Sales Report - ${filterType}`;
            worksheet.getCell('A2').font = { size: 12 };
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            let rowIndex = 3;
            if (fromDate && toDate) {
                worksheet.mergeCells(`A${rowIndex}:I${rowIndex}`); // ✅ WIDER for 9 columns
                worksheet.getCell(`A${rowIndex}`).value = `Date Range: ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`;
                worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'center' };
                rowIndex++;
            } else if (filterType !== 'All') {
                let periodText = "";
                switch (filterType) {
                    case 'Daily':
                        periodText = "Today";
                        break;
                    case 'Weekly':
                        periodText = "This Week (From Sunday)";
                        break;
                    case 'Monthly':
                        periodText = "Current Month";
                        break;
                    case 'Yearly':
                        periodText = "Current Year";
                        break;
                }

                worksheet.mergeCells(`A${rowIndex}:I${rowIndex}`); // ✅ WIDER for 9 columns
                worksheet.getCell(`A${rowIndex}`).value = `Period: ${periodText}`;
                worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'center' };
                rowIndex++;
            }

            worksheet.mergeCells(`A${rowIndex}:I${rowIndex}`); // ✅ WIDER for 9 columns
            worksheet.getCell(`A${rowIndex}`).value = `Generated on: ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`;
            worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'center' };
            rowIndex += 2;

            // ✅ ENHANCED SUMMARY SECTION (7 fields like PDF)
            worksheet.mergeCells(`A${rowIndex}:I${rowIndex}`); // ✅ WIDER for 9 columns
            worksheet.getCell(`A${rowIndex}`).value = 'Summary';
            worksheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14 };
            worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'center' };
            rowIndex++;

            worksheet.mergeCells(`A${rowIndex}:D${rowIndex}`);
            worksheet.getCell(`A${rowIndex}`).value = `Overall Sales Count: ${totalOrders}`;
            worksheet.getCell(`A${rowIndex}`).font = { bold: true };
            rowIndex++;

            worksheet.mergeCells(`A${rowIndex}:D${rowIndex}`);
            worksheet.getCell(`A${rowIndex}`).value = `Overall Sales Amount: ₹${totalSales.toLocaleString()}.00`;
            worksheet.getCell(`A${rowIndex}`).font = { bold: true };
            rowIndex++;

            worksheet.mergeCells(`A${rowIndex}:D${rowIndex}`);
            worksheet.getCell(`A${rowIndex}`).value = `Total Coupons Used: ${totalCouponsUsed}`;
            rowIndex++;

            worksheet.mergeCells(`A${rowIndex}:D${rowIndex}`);
            worksheet.getCell(`A${rowIndex}`).value = `Admin Coupons: ${adminCouponsUsed}`;
            rowIndex++;

            worksheet.mergeCells(`A${rowIndex}:D${rowIndex}`);
            worksheet.getCell(`A${rowIndex}`).value = `Referral Coupons: ${referralCouponsUsed}`;
            rowIndex++;

            worksheet.mergeCells(`A${rowIndex}:I${rowIndex}`);
            worksheet.getCell(`A${rowIndex}`).value = `Total Savings Given: ₹${totalAllCouponSavings.toLocaleString()}.00 (Through all coupons)`;
            rowIndex++;

            worksheet.mergeCells(`A${rowIndex}:I${rowIndex}`);
            worksheet.getCell(`A${rowIndex}`).value = `Total Offer Savings: ₹${Math.round(totalOfferSavingsAllOrders).toLocaleString()}.00 (Product & category offers)`;
            rowIndex += 2;

            // ✅ ENHANCED TABLE HEADERS (9 columns like PDF)
            const headers = ['Order ID', 'Date', 'Customer Name', 'Product', 'Order Status', 'Payment Method', 'Offer Applied', 'Discount', 'Amount'];
            const headerRow = worksheet.addRow(headers);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'f0f0f0' }
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            orders.forEach((order, index) => {
                // ✅ ENHANCED ROW DATA (9 columns like PDF)

                // 1. Product names (combine all products with null checks)
                const productNames = order.order_items
                    .filter(item => item.productId && item.productId.productName)
                    .map(item => item.productId.productName)
                    .join(', ');
                const products = productNames.length > 0 ? productNames : 'Deleted Products';

                // 2. Payment method
                const paymentMethod = order.payment_method === 'cod' ? 'COD' :
                                    order.payment_method === 'razorpay' ? 'Razorpay' :
                                    order.payment_method === 'wallet' ? 'Wallet' :
                                    order.payment_method || 'Unknown';

                // 3. Offer applied calculation
                const offerSavings = order.order_items.reduce((sum, item) => {
                    if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
                        const regularPrice = item.productId.regularPrice;
                        const salePrice = item.productId.salePrice;
                        const savingsPerItem = regularPrice - salePrice;
                        return sum + (savingsPerItem * item.quantity);
                    }
                    return sum;
                }, 0);

                const offerText = offerSavings > 0 ? `₹${Math.round(offerSavings)} Off` :
                                order.discount > 0 ? `₹${order.discount} Off` : 'No Offer';

                // 4. Create row with all 9 columns
                const row = worksheet.addRow([
                    `#${order.orderId}`,                                    // Order ID
                    new Date(order.createdAt).toLocaleDateString(),        // Date
                    order.user_id?.name || 'Unknown',                      // Customer Name
                    products,                                               // Product
                    order.status,                                           // Order Status
                    paymentMethod,                                          // Payment Method
                    offerText,                                              // Offer Applied
                    `₹${order.discount || 0}`,                             // Discount
                    `₹${(order.finalAmount || order.total).toFixed(2)}`    // Amount
                ]);

                if (index % 2 === 0) {
                    row.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'f9f9f9' }
                        };
                    });
                }

                // Add borders to all cells
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // ✅ ENHANCED COLUMN WIDTHS for 9 columns
            worksheet.columns = [
                { width: 15 },  // Order ID
                { width: 12 },  // Date
                { width: 18 },  // Customer Name
                { width: 25 },  // Product (wider for multiple products)
                { width: 15 },  // Order Status
                { width: 15 },  // Payment Method
                { width: 18 },  // Offer Applied
                { width: 12 },  // Discount
                { width: 15 }   // Amount
            ];

            const fileName = 'TAKE_YOUR_TIME_sales_report.xlsx';

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.log("Error generating Excel report", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }




}



const getDateRange = (filterType, fromDate, toDate) => {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    if (fromDate && toDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);

        return { start, end };
    }

    switch (filterType) {
        case 'Daily':
            return { start: startOfDay, end: endOfDay };

        case 'Weekly':
            const lastSunday = new Date(today);
            lastSunday.setDate(today.getDate() - today.getDay());
            lastSunday.setHours(0, 0, 0, 0);
            return { start: lastSunday, end: endOfDay };

        case 'Monthly':
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            startOfMonth.setHours(0, 0, 0, 0);
            return { start: startOfMonth, end: endOfDay };

        case 'Yearly':
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            startOfYear.setHours(0, 0, 0, 0);
            return { start: startOfYear, end: endOfDay };

        default:
            return { start: new Date(0), end: endOfDay };
    }
};
