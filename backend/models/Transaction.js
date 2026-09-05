const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  amount: { type: Number, required: true }, // In INR
  status: { 
    type: String, 
    enum: ['failed', 'recovery_in_progress', 'recovered', 'escalated'], 
    default: 'failed' 
  },
  failureReason: { type: String, required: true }, // e.g., 'insufficient_funds', 'timeout'
  
  // Context for the AI
  pastSuccessfulPayments: { type: Number, default: 0 }, 
  
  // The AI's decision outputs
  aiRecommendation: {
    action: { type: String, enum: ['PAYMENT_LINK', 'RETRY', 'ESCALATE', null], default: null },
    reason: { type: String, default: null }
  },
  
  // Razorpay tracking
  razorpayPaymentLinkId: { type: String, default: null }, 
  
  // The crucial proof for the judges
  auditTrail: [{
    timestamp: { type: Date, default: Date.now },
    message: { type: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);