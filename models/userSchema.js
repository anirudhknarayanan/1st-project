const mongoose = require("mongoose")

const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        default: null
    }
    ,
    googleId: { type: String, unique: true, required: false, sparse: true },

    password: {
        type: String,
        required: false,
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart"
    }],
    wallet: {
        type: Number,

    },
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist"

    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referalCode: {
        type: String
    },
    redeemed: {
        type: Boolean,

    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User"

    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        brand: {
            type: String,
        },
        searchOne: {
            type: Date,
            default: Date.now
        }

    }],
    userImage : {
        type : String,
        required : false
    }
})

const User = mongoose.model("User", userSchema)

module.exports = User;