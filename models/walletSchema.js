const mongoose = require('mongoose');
const {Schema} = mongoose

const walletSchema = new Schema({
   userId: { 
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
   },
   balance:{
      type: Number,
      default: 0
   },
   transactions: [
       {
           type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
         },
           amount: {
            type: Number,
            required: true
         },
           description: {
            type: String
         },
           status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'completed'
         },
           createdAt: {
            type: Date,
            default: Date.now
         }
       }
   ]
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
