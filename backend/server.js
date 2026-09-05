require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const cors = require('cors');
const Transaction = require('./models/Transaction');
const { analyzeFailedPayment } = require('./services/aiService');

const app = express();
app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const MONGO_URI = process.env.MONGO_URI  || 'mongodb://127.0.0.1:27017/razorpay-hackathon';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

app.get('/api/health', (req, res) => {
  res.json({ status: 'active', message: 'Recovery Agent Backend Running' });
});


// --- FETCH TRANSACTIONS FOR DASHBOARD ---
app.get('/api/transactions', async (req, res) => {
  try {
    // Fetch 10 transactions to display/test
    const transactions = await Transaction.find().limit(10);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// --- THE RECOVERY ENDPOINT ---
app.post('/api/recover/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // Step 1: Log the start of the process
    transaction.auditTrail.push({ message: 'AI Agent started analysis of failed transaction.' });
    await transaction.save();

    // Step 2: Ask the AI for a decision
    const aiDecision = await analyzeFailedPayment(transaction);
    
    transaction.aiRecommendation = aiDecision;
    transaction.auditTrail.push({ message: `AI determined action: ${aiDecision.action}. Reason: ${aiDecision.reason}` });
    
    // Step 3: Execute the Business Logic
    if (aiDecision.action === 'PAYMENT_LINK') {
      transaction.auditTrail.push({ message: 'Initializing Razorpay Payment Link generation...' });
      
      try {
        // Razorpay expects the amount in paise (multiply INR by 100)
        const paymentLink = await razorpay.paymentLink.create({
          amount: transaction.amount * 100,
          currency: 'INR',
          accept_partial: false,
          description: 'Payment Recovery for Failed Transaction',
          customer: {
            name: transaction.customerName,
            email: transaction.customerEmail
          },
          notify: { sms: false, email: false }, // Set false for demo so you don't spam fake emails
          reminder_enable: true
        });

        transaction.razorpayPaymentLinkId = paymentLink.id;
        // Save the actual clickable URL in the audit trail for the frontend demo
        transaction.auditTrail.push({ message: `✅ Razorpay Link Generated: ${paymentLink.short_url}` });
        transaction.status = 'recovery_in_progress';

      } catch (rzpError) {
        console.error('Razorpay API Error:', rzpError);
        transaction.auditTrail.push({ message: '❌ Failed to generate Razorpay link via API.' });
        transaction.status = 'escalated';
      }
    } else if (aiDecision.action === 'ESCALATE') {
        transaction.status = 'escalated';
    }

    await transaction.save();
    res.json({ success: true, transaction });

  } catch (error) {
    console.error('Recovery Route Error:', error);
    res.status(500).json({ error: 'Server error during recovery process' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));