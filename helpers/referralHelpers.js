const User = require("../models/userSchema");
const Referral = require("../models/referralSchema");
const crypto = require("crypto");

/**
 * TOOL 1: Generate a unique referral code for a user
 * Input: User's name (like "John")
 * Output: Unique code (like "JOHN1234")
 */
const generateReferralCode = async (userName) => {
    try {
        // Take first 4 letters from name and make them uppercase
        const namePrefix = userName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
        const paddedName = namePrefix.padEnd(4, 'X'); // If name is short, add X's

        // Generate 4 random numbers
        const randomNumbers = Math.floor(1000 + Math.random() * 9000);

        let referralCode = `${paddedName}${randomNumbers}`;

        // Make sure this code doesn't already exist
        let counter = 1;
        while (await User.findOne({ referralCode })) {
            referralCode = `${paddedName}${randomNumbers + counter}`;
            counter++;
        }

        return referralCode;
    } catch (error) {
        console.error("Error generating referral code:", error);
        // If something goes wrong, use timestamp as backup
        return `REF${Date.now().toString().slice(-5)}`;
    }
};

/**
 * TOOL 2: Check if a referral code is valid
 * Input: Referral code (like "JOHN1234")
 * Output: {valid: true/false, referrer: user info}
 */
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

/**
 * TOOL 3: Generate unique coupon code for referral rewards
 * Output: Unique coupon code (like "REF1A2B3C4D")
 */
const generateCouponCode = () => {
    return `REF${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

/**
 * TOOL 4: Give reward to referrer when someone uses their code
 * Input: Referrer's ID, New user's ID
 * Output: Success/failure result
 */
const processReferralReward = async (referrerId, newUserId) => {
    try {
        // Create a ₹100 coupon for the referrer
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

/**
 * TOOL 5: Get all referral coupons for a user
 * Input: User's ID
 * Output: List of their referral coupons
 */
const getUserReferralCoupons = async (userId) => {
    try {
        const coupons = await Referral.find({
            referrer: userId  // Only get coupons where this user is the referrer
        }).populate('referrer', 'name')
          .populate('referredUser', 'name')
          .sort({ createdAt: -1 })
          .lean(); // Convert to plain JavaScript objects

        return coupons;
    } catch (error) {
        console.error("Error getting user referral coupons:", error);
        return [];
    }
};

/**
 * TOOL 6: Check if a coupon is valid and can be used
 * Input: User's ID, Coupon code
 * Output: {valid: true/false, coupon: coupon info, discount: amount}
 */
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

/**
 * TOOL 7: Mark a coupon as used when order is placed
 * Input: Coupon code, Order ID
 * Output: Success/failure
 */
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
        console.log("✅ Referral coupon marked as used successfully:", result);
        return true;
    } catch (error) {
        console.error("❌ Error marking referral coupon as used:", error);
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