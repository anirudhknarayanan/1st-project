const User = require("../models/userSchema");
const Referral = require("../models/referralSchema");
const crypto = require("crypto");


const generateReferralCode = async (userName) => {
    
    try {
        
        const namePrefix = userName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
        const paddedName = namePrefix.padEnd(4, 'X');

       
        const randomNumbers = Math.floor(1000 + Math.random() * 9000);

        let referralCode = `${paddedName}${randomNumbers}`;

        
        let counter = 1;
        while (await User.findOne({ referralCode })) {
            referralCode = `${paddedName}${randomNumbers + counter}`;
            counter++;
        }

        return referralCode;
    } catch (error) {
        console.error("Error generating referral code:", error);
    
        return `REF${Date.now().toString().slice(-5)}`;
    }
};



const validateReferralCode = async (referralCode, excludeUserId = null) => {
    try {
        const referrer = await User.findOne({
            referralCode,
            isBlocked: false,
            _id: { $ne: excludeUserId } // Don't let users refer themselves
        });

        return {
            valid: !!referrer,
            referrer: referrer
        };
    } catch (error) {
        console.error("Error validating referral code:", error);
        return { valid: false, referrer: null };
    }
};


const generateCouponCode = () => {
    return `REF${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};


const processReferralReward = async (referrerId, newUserId) => {
    try {
      
        const couponCode = generateCouponCode();
        const referralCoupon = new Referral({
            referrer: referrerId,
            referredUser: newUserId,
            couponCode: couponCode,
            discount: 100,  // ₹100 discount
            status: "unused"
        });

        await referralCoupon.save();

        return {
            success: true,
            couponCode: couponCode
        };
    } catch (error) {
        console.error("Error processing referral reward:", error);
        return { success: false, error: error.message };
    }
};


const getUserReferralCoupons = async (userId) => {
    try {
        const coupons = await Referral.find({
            referrer: userId  
        }).populate('referrer', 'name')
          .populate('referredUser', 'name')
          .sort({ createdAt: -1 })
          .lean(); 

        return coupons;
    } catch (error) {
        console.error("Error getting user referral coupons:", error);
        return [];
    }
};


const validateReferralCoupon = async (userId, couponCode) => {
    try {
        const coupon = await Referral.findOne({
            couponCode,
            status: "unused",
            referrer: userId  // Only the referrer can use their own coupon
        });

        return {
            valid: !!coupon,
            coupon: coupon,
            discount: coupon ? coupon.discount : 0
        };
    } catch (error) {
        console.error("Error validating referral coupon:", error);
        return { valid: false, coupon: null, discount: 0 };
    }
};


const markReferralCouponAsUsed = async (couponCode, orderId) => {
    try {
        console.log("🔄 Marking referral coupon as used:", couponCode, "Order ID:", orderId);
        const result = await Referral.findOneAndUpdate(
            { couponCode },
            {
                status: "used",
                usedAt: new Date(),
                orderId: orderId
            }
        );
        console.log(" Referral coupon marked as used successfully:", result);
        return true;
    } catch (error) {
        console.error(" Error marking referral coupon as used:", error);
        return false;
    }
};

// Export all our tools so other files can use them
module.exports = {
    generateReferralCode,
    validateReferralCode,
    processReferralReward,
    getUserReferralCoupons,
    validateReferralCoupon,
    markReferralCouponAsUsed
};