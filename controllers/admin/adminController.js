const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../../models/orderSchema");
const moment = require("moment");



module.exports = {
    adminLogin: async (req, res) => {
        try {
            if (req.session.admin) {
                res.redirect("/")
            }
            res.render("admin/admin-login", { hideFooter: true })
        } catch (error) {
            res.status(404).send("server error")

        }


    },
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            console.log("hii", req.body);

            const admin = await User.findOne({ email: email, isAdmin: true })
            if (admin) {
                console.log("admin :", admin);

                const passwordMatch = await bcrypt.compare(password, admin.password)
                if (passwordMatch) {
                    req.session.admin = admin._id;
                    console.log("hey thre");

                    res.redirect("/admin")
                } else {
                    console.log("uighis");

                    return res.redirect("/admin/login")
                }
            } else {
                console.log("hii");

                return res.redirect("/admin/login")
            }
        } catch (error) {
            console.log("login error", error);
            return res.redirect("/pageerror")

        }

    },
    loadDashBoard: async (req, res) => {

        try {

            if (!req.session.admin) {
                return res.redirect("admin/login");
            }

            const order = await Order.find({ status: { $nin: ["failed"] } })
                .populate("user_id", 'name email phone')
                .populate("order_items.productId", 'productName productImage price')
                .sort({ createdAt: -1 });
            console.log("your order: ", order);

            const timeFilter = req.query.timeFilter || 'weekly';

            console.log(timeFilter);


            const dashboardData = await getDashboardData(timeFilter);

            console.log("dashBordData : ", dashboardData)





            res.render("admin/dashboard", {
                dashboardData,
                admin: true
            })




        } catch (error) {
            console.error("Dashboard load error:", error); // Add this
            res.redirect("/pageerror");
        }
    },


    getPageerror: async (req, res) => {
        res.render("admin/admin-error", { admin: true })
    },


    logout: async (req, res) => {

        try {
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).send("logout failed")
                } else {
                    res.redirect("/admin/login")
                }
            })
        } catch (error) {
            console.log("logout error");
            res.redirect("/pageerror")


        }
    },

    
    getDashboardDataAPI: async (req, res) => {
        try {
            const { timeFilter } = req.query;
            if (!timeFilter) {
                return res.status(400).json({ error: 'timeFilter parameter is required' });
            }

            const dashboardData = await getDashboardData(timeFilter);
            res.json(dashboardData);
        } catch (err) {
            console.log('Dashboard data API error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

async function getDashboardData(timeFilter) {

    const currentDate = new Date();



    let startDate, labels, format, aggregateBy;

    switch (timeFilter) {
        case 'weekly':
            startDate = moment().subtract(6, 'days').startOf('day').toDate();
            labels = Array.from({ length: 7 }, (_, i) =>
                moment().subtract(6 - i, 'days').format('ddd')
            );
            format = '%Y-%m-%d';
            aggregateBy = { day: '$createdAt' };
            break;
        case 'yearly':
            startDate = moment().subtract(5, 'years').startOf('year').toDate();
            labels = Array.from({ length: 6 }, (_, i) =>
                moment().subtract(5 - i, 'years').format('YYYY')
            );
            format = '%Y';
            aggregateBy = { year: '$createdAt' };
            break;
        case 'monthly':
        default:
            startDate = moment().subtract(5, 'months').startOf('month').toDate();
            labels = Array.from({ length: 6 }, (_, i) =>
                moment().subtract(5 - i, 'months').format('MMM')
            );
            format = '%Y-%m';
            aggregateBy = { month: '$createdAt' };
    }

    const totalRevenue = await Order.aggregate([{
        $match: { status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded', 'pending'] } }
    },
    { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    console.log(totalRevenue);


    const totalCustomers = await User.countDocuments({ isAdmin: false });

    const totalOrders = await Order.countDocuments({
        status: { $nin: ['cancelled', 'failed'] }
    });

    const previousPeriodStart = moment(startDate).subtract(
        timeFilter === 'weekly' ? 7 :
            timeFilter === 'yearly' ? 6 : 6,
        timeFilter === 'weekly' ? 'days' :
            timeFilter === 'yearly' ? 'years' : 'months'
    ).toDate();

    const currentPeriodRevenue = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: currentDate },
                status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded'] }
            }
        },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    const previousPeriodRevenue = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: previousPeriodStart, $lt: startDate },
                status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded'] }
            }
        },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    const revenueGrowth = calculateGrowthPercentage(
        currentPeriodRevenue[0]?.total || 0,
        previousPeriodRevenue[0]?.total || 0
    );

    const currentPeriodCustomers = await User.countDocuments({
        createdAt: { $gte: startDate, $lte: currentDate },
        isAdmin: false
    });

    const previousPeriodCustomers = await User.countDocuments({
        createdAt: { $gte: previousPeriodStart, $lt: startDate },
        isAdmin: false
    });


    const customerGrowth = calculateGrowthPercentage(
        currentPeriodCustomers,
        previousPeriodCustomers
    );


    // Get orders growth percentage
    const currentPeriodOrders = await Order.countDocuments({
        createdAt: { $gte: startDate, $lte: currentDate },
        status: { $nin: ['cancelled', 'failed'] }
    });

    const previousPeriodOrders = await Order.countDocuments({
        createdAt: { $gte: previousPeriodStart, $lt: startDate },
        status: { $nin: ['cancelled', 'failed'] }
    });



    const orderGrowth = calculateGrowthPercentage(
        currentPeriodOrders,
        previousPeriodOrders
    );

    // Get sales data over time
    const salesByPeriod = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: currentDate },
                status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded'] }
            }
        },
        {
            $group: {
                _id: timeFilter === 'weekly'
                    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    : timeFilter === 'yearly'
                        ? { $dateToString: { format: '%Y', date: '$createdAt' } }
                        : { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                total: { $sum: '$finalAmount' }
            }
        },
        { $sort: { '_id': 1 } }
    ]);

    const customersByPeriod = await User.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: currentDate },
                isAdmin: false
            }
        },
        {
            $group: {
                _id: timeFilter === 'weekly'
                    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    : timeFilter === 'yearly'
                        ? { $dateToString: { format: '%Y', date: '$createdAt' } }
                        : { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } }
    ]);

    // Get orders over time
    const ordersByPeriod = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: currentDate },
                status: { $nin: ['cancelled', 'failed'] }
            }
        },
        {
            $group: {
                _id: timeFilter === 'weekly'
                    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    : timeFilter === 'yearly'
                        ? { $dateToString: { format: '%Y', date: '$createdAt' } }
                        : { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } }
    ]);


    // Get category performance
    const categoryPerformance = await Order.aggregate([
        {
            $match: {
                status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded'] }
            }
        },
        { $unwind: '$order_items' },
        {
            $lookup: {
                from: 'products',
                localField: 'order_items.productId',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: '$productDetails' },
        {
            $lookup: {
                from: 'categories',
                localField: 'productDetails.category',
                foreignField: '_id',
                as: 'categoryDetails'
            }
        },
        { $unwind: '$categoryDetails' },
        {
            $group: {
                _id: '$categoryDetails._id',
                categoryName: { $first: '$categoryDetails.name' },
                totalSales: { $sum: { $multiply: ['$order_items.price', '$order_items.quantity'] } }
            }
        },
        { $sort: { totalSales: -1 } },
        { $limit: 5 }
    ]);



    // Get recent orders
    const recentOrders = await Order.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                as: 'userDetails'
            }
        },
        { $unwind: '$userDetails' },
        {
            $project: {
                orderId: 1,
                customer: '$userDetails.name',
                product: { $arrayElemAt: ['$order_items.productId.productName', 0] },
                // productImages: { $arrayElemAt: ['$order_items.productId.productImages', 0] } ,
                date: '$createdAt',
                amount: '$finalAmount',
                status: 1
            }
        }
    ]);


    // Map data to chart format with labels
    const salesData = mapDataToLabels(salesByPeriod, labels, timeFilter, 'total');
    const customersData = mapDataToLabels(customersByPeriod, labels, timeFilter, 'count');
    const ordersData = mapDataToLabels(ordersByPeriod, labels, timeFilter, 'count');

    // Prepare category data
    const categoryLabels = categoryPerformance.map(cat => cat.categoryName);
    const categoryData = categoryPerformance.map(cat => cat.totalSales);


    return {
        summary: {
            totalRevenue: totalRevenue[0]?.total || 0,
            totalCustomers,
            totalOrders,
            revenueGrowth,
            customerGrowth,
            orderGrowth
        },
        sales: {
            labels,
            data: salesData
        },
        customers: {
            labels,
            data: customersData
        },
        orders: {
            labels,
            data: ordersData
        },
        categories: {
            labels: categoryLabels,
            data: categoryData
        },
        recentOrders
    };

}




function calculateGrowthPercentage(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number(((current - previous) / previous * 100).toFixed(1));
}



function mapDataToLabels(data, labels, timeFilter, valueField) {
    const result = [];
    const dataMap = new Map();

    data.forEach(item => {
        let key;
        if (timeFilter === 'weekly') {
            key = moment(item._id).format('ddd');
        } else if (timeFilter === 'yearly') {
            key = item._id;
        } else {
            key = moment(item._id, 'YYYY-MM').format('MMM');
        }
        dataMap.set(key, item[valueField]);
    });

    labels.forEach(label => {
        result.push(dataMap.get(label) || 0);
    });

    return result;
}