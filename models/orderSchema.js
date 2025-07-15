const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');
const Product = require('./productSchema');

const orderSchema = new Schema({
   orderId: {
      type: String,
      default: () => `ORD-${uuidv4().split('-')[0]}`,
      unique: true
   },
   user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
   },
   address_id: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true
   },
   shippingAddress: {
      addressType: { type: String, required: true },
      name: { type: String, required: true },
      city: { type: String, required: true },
      landMark: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: Number, required: true },
      phone: { type: Number, required: true },
      altPhone: { type: Number }
   },
   payment_method: {
      type: String,
      enum: ["cod", "razorpay"],
      required: true
   },

  order_items: [{
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  originalPrice: {
    type: Number,
    default: 0
  },
  appliedOffer: {
    type: Number,
    default: 0
  },
  appliedOfferType: {
    type: String,
    enum: ['product', 'category', null],
    default: null
  },
  quantity: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: [
      "active",
      "cancelled",
      "returned",
      "return requested",
      "return approved",
      "return rejected"
    ],
    default: "active"
  },
  cancel_reason: {
    type: String,
    default: null
  },
  cancelled_at: {
    type: Date,
    default: null
  },
  cancelled_quantity: {
    type: Number,
    default: 0
  },
  return_reason: {
    type: String,
    default: null
  },
  returned_at: {
    type: Date,
    default: null
  },
  return_qty: {                      // ✅ NEW FIELD
    type: Number,
    default: 0
  }
}]

   ,


   total: {
      type: Number,
      required: true
   },
   discount: {
      type: Number,
      default: 0
   },
   finalAmount: {
      type: Number,
      required: true
   },
   status: {
      type: String,
      enum: [
         "pending", "processing", "shipped", "delivered", "cancelled",
         "Return requested", "Return approved", "Return rejected",
         "refunded", "failed"
      ],
      default: "pending"
   },
   paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending"
   },
   returnReason: {
      type: String,
      default: null
   },
   adminReturnStatus: {
      type: String,
      default: null
   },
   coupenApplied: {
      type: String,
      default: "false"
   },
   invoiceDate: {
      type: Date,
      default: Date.now
   }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
