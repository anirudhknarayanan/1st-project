const Coupon = require("../../models/coupenSchema");


module.exports = {

    getCouponpage: async (req, res) => {
        try {
            let page = parseInt(req.query.page) || 1;
            let limit = 8;
            let skip = (page - 1) * limit;

            const coupons = await Coupon.find().sort({ couponValidity: -1 }).skip(skip).limit(limit).lean()
            let totalCoupns = await Coupon.countDocuments();
            let totalPages = Math.ceil(totalCoupns / limit)



            res.render("admin/coupon", { coupons, currentPage: page, totalPages, admin: true })

        } catch (error) {
            console.log("error in coupon page", error)
            return res.status(500).json({ success: false, message: "Internal server error" })
        }
    },

    addCoupon: async (req, res) => {
        try {
            const { couponCode, couponType, discount, minPurchase, maxDiscount, expiryDate, usageLimit } = req.body;


            if (!couponCode || !couponType || !discount || !minPurchase || !expiryDate || !maxDiscount || !usageLimit) {
                return res.status(400).json({
                    success: false,
                    message: "All fields are required!",
                    missingFields: {
                        couponCode: !couponCode,
                        couponType: !couponType,
                        discount: !discount,
                        minPurchase: !minPurchase,
                        maxDiscount: !maxDiscount,
                        expiryDate: !expiryDate,
                        usageLimit: !usageLimit
                    }
                });
            }

            if (couponType !== 'percentage') {
                return res.status(400).json({
                    success: false,
                    message: "Invalid coupon type. Must be 'percentage'."
                });
            }

            const existingCoupon = await Coupon.findOne({ couponCode }).lean();
            if (existingCoupon) {
                return res.status(400).json({
                    success: false,
                    message: "Coupon code already exists!"
                });
            }

            const parsedDiscount = parseFloat(discount);
            const parsedMinPurchase = parseFloat(minPurchase);
            const parsedMaxDiscount = parseFloat(maxDiscount);
            const parsedUsageLimit = parseFloat(usageLimit);

            if (isNaN(parsedDiscount) || parsedDiscount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Discount must be a positive number"
                });
            }

            if (couponType === 'percentage') {
                if (parsedDiscount > 100) {
                    return res.status(400).json({
                        success: false,
                        message: "Percentage discount cannot exceed 100%"
                    });
                }
            }
            if (isNaN(parsedMinPurchase) || parsedMinPurchase < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Minimum purchase must be a non-negative number"
                });
            }
            if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Maximum discount must be a non-negative number"
                })
            }

            const parsedExpiryDate = new Date(expiryDate);
            if (parsedExpiryDate < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: "Expiry date must be in the future"
                });
            }

            if (isNaN(parsedUsageLimit) || parsedUsageLimit <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Usage limit must be a positive number"
                });
            }

            const newCoupon = new Coupon({
                couponCode,
                couponType,
                couponDiscount: parsedDiscount,
                couponMinAmount: parsedMinPurchase,
                couponMaxAmount: parsedMaxDiscount,
                couponValidity: parsedExpiryDate,
                limit: parsedUsageLimit,
                isActive: true
            });

            await newCoupon.save();

            res.status(201).json({
                success: true,
                message: "Coupon added successfully",
                coupon: newCoupon
            });






        } catch (error) {

            console.error("Detailed error in add coupon:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
                errorDetails: error.message
            });

        }
    },

    toggleCoupon: async (req, res) => {
        try {
            const couponId = req.params.id;
            const { isActive } = req.body;
            const couponToToggle = await Coupon.findById(couponId)


            if (!couponToToggle) {
                return res.status(404).json({
                    success: false,
                    message: "Coupon not found"
                })
            }

            couponToToggle.isActive = isActive;

            await couponToToggle.save()

            res.status(200).json({
                success: true,
                message: `Coupon ${isActive ? 'activated' : 'inactivated'} successfully`,
                isActive: couponToToggle.isActive
            })

        } catch (error) {
            console.log("error toggling coupon", error)
            res.status(500).json({
                success: false,
                message: "Internal server error",
                errorDetails: error.message
            })
        }
    }

}