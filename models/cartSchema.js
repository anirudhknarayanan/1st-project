const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        },
        price: { // Final unit price after discount
            type: Number,
            required: true
        },
        totalPrice: { // quantity * price
            type: Number,
            required: true
        },
        appliedOffer: { // percentage (e.g., 10, 20)
            type: Number,
            default: 0
        },
        appliedOfferType: { // 'product', 'category', or null
            type: String,
            enum: ['product', 'category', null],
            default: null
        },
        status: {
            type: String,
            default: "placed"
        },
        cancellationReason: {
            type: String,
            default: "none"
        }
    }],
    cartTotal: { // overall cart total
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
