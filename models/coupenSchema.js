const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
    couponCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    couponType: {
        type: String,
        required: true,
        enum: ["percentage"]
    },
    couponDiscount: {
        type: Number, 
        required: true
    },
    couponValidity: {
        type: Date,
        required: true
    },
    couponMinAmount: {
        type: Number,
        required: true
    },
    couponMaxAmount: {  //// Optional
        type: Number,
        required: true
    },
    couponDescription: {  //// Optional
        type: String,
        required: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    limit: {
        type: Number,
        default: 1
    },
    usageCount: {
        type: Number,
        default: 0 // Track how many times this coupon has been used
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon