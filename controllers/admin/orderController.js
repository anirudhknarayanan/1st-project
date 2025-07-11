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
    },



    approveItemReturn: async (req, res) => {
        try {
            const { orderId, productId } = req.body;

            console.log(orderId,productId);
            

            if (!orderId || !productId) {
                return res.status(400).json({ success: false, message: "Missing orderId or productId" });
            }


            const order = await Order.findById(orderId);

            console.log("return item order : ",order)
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

          // Find the item to approve
        const item = order.order_items.find(item => item.productId.toString() === productId);
        if (!item || item.status !== 'return requested') {
            return res.status(400).json({ success: false, message: "Item not eligible for return" });
        }

         // Update product stock
        await Product.findByIdAndUpdate(productId, {
            $inc: { quantity: item.quantity }
        });

         item.status = 'returned';
        item.returned_at = new Date();

        await order.save();

                // Credit to wallet
        const userId = order.user_id;
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: 0,
                transactions: []
            });
        }

        wallet.balance += item.price * item.quantity;
        wallet.transactions.push({
            type: 'credit',
            amount: item.price * item.quantity,
            description: `Refund for returned item (${item.productName})`,
            status: 'completed'
        });

        await wallet.save();

        return res.status(200).json({ success: true, message: "Item return approved" });






        } catch (error) {


            console.error("Error approving item return", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });

        }
    },

    rejectItemReturn : async (req,res)=>{


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
}


    

}