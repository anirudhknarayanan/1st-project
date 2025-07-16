const mongoose = require("mongoose");
const { Schema } = mongoose;

// This is like creating a form template for referral information
const referralSchema = new Schema({
    // Who gave the referral code (the existing user)
    referrer: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    // Who used the referral code (the new user)
    referredUser: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    // The unique coupon code given to referrer (like GIFT1234)
    couponCode: {
        type: String,
        required: true,
        unique: true
    },
    
    // How much discount this coupon gives (₹100)
    discount: {
        type: Number,
        required: true,
        default: 100
    },
    
    // Is this coupon used or not? (unused/used)
    status: {
        type: String,
        enum: ["unused", "used"],
        default: "unused"
    },
    
    // When was this referral created?
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    // When was this coupon used? (null if not used yet)
    usedAt: {
        type: Date,
        default: null
    },
    
    // Which order was this coupon used in? (null if not used yet)
    orderId: {
        type: Schema.Types.ObjectId,
        ref: "Order",
        default: null
    }
});

// Create indexes for faster searching
referralSchema.index({ referrer: 1 });
referralSchema.index({ referredUser: 1 });
referralSchema.index({ couponCode: 1 });
referralSchema.index({ status: 1 });

module.exports = mongoose.model("Referral", referralSchema);
