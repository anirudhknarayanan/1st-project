const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const { Admin } = require("mongodb");


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


            res.render('admin/orderMang', {
                admin: true,
                orders,
                returnRequests,
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
            const { orderId } = req.body


            if (!orderId) {
                return res.status(404).json({ success: false, message: "order not found" })
            }


            const order = await Order.findByIdAndUpdate(orderId, { status: 'Return approved' })

            const userId = order.user_id;


            for (let item of order.order_items) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } });
            }

            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({
                    userId,
                    balance: 0,
                    transactions: []
                });
            }

            wallet.balance += order.total;
            wallet.transactions.push({
                type: 'credit',
                amount: order.total,
                description: `Refund for returned order`,
                status: 'completed'
            });

            await wallet.save();


            res.status(200).json({ success: true, message: "Return approved" })


        } catch (error) {

            console.log("error approving return", error)
            res.status(500).json({ success: false, message: "internal server error" })

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
    }

}