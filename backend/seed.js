const mongoose = require('mongoose');
const Transaction = require('./models/Transaction');
require('dotenv').config();

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/razorpay-hackathon';

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // Clear existing data for a fresh demo state
    await Transaction.deleteMany({});
    console.log('🧹 Cleared existing transactions');

    // Realistic Razorpay failure reasons
    const scenarios = [
      {
        customerName: 'Rahul Sharma',
        customerEmail: 'rahul.s@example.com',
        amount: 2499,
        failureReason: 'insufficient_funds',
        pastSuccessfulPayments: 12, // High trust: good candidate for a payment link
      },
      {
        customerName: 'Priya Patel',
        customerEmail: 'priya.p@example.com',
        amount: 8500,
        failureReason: 'gateway_technical_error',
        pastSuccessfulPayments: 3, // Bank issue: good candidate for a retry
      },
      {
        customerName: 'Amit Singh',
        customerEmail: 'amit.singh@example.com',
        amount: 15000,
        failureReason: 'card_expired',
        pastSuccessfulPayments: 1, // Hard failure: needs human escalation or new payment method
      },
      {
        customerName: 'Sneha Gupta',
        customerEmail: 'sneha.g@example.com',
        amount: 999,
        failureReason: 'payment_timed_out',
        pastSuccessfulPayments: 5, // Dropped off: good candidate for a reminder link
      },
      {
        customerName: 'Vikram Desai',
        customerEmail: 'vikram.d@example.com',
        amount: 45000,
        failureReason: 'card_declined', 
        pastSuccessfulPayments: 0, // High risk, new user: needs human escalation
      },
      {
        customerName: 'Ananya Reddy',
        customerEmail: 'ananya.r@example.com',
        amount: 3200,
        failureReason: 'incorrect_cvv',
        pastSuccessfulPayments: 8, // User error: good candidate for immediate retry/link
      }
    ];

    // Generate 50 transactions based on the templates above to fill out the dashboard
    const transactionsToInsert = [];
    
    for (let i = 0; i < 50; i++) {
      const template = scenarios[Math.floor(Math.random() * scenarios.length)];
      
      transactionsToInsert.push({
        customerName: template.customerName,
        customerEmail: `user${i}@example.com`,
        amount: template.amount,
        status: 'failed',
        failureReason: template.failureReason,
        pastSuccessfulPayments: template.pastSuccessfulPayments,
        auditTrail: [{
          timestamp: new Date(),
          message: `Payment failed due to ${template.failureReason}. Added to recovery queue.`
        }]
      });
    }

    await Transaction.insertMany(transactionsToInsert);
    console.log(`🌱 Successfully seeded ${transactionsToInsert.length} failed transactions.`);
    
    process.exit();
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedData();