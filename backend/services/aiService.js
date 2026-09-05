const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Gemini (Ensure GEMINI_API_KEY is in your .env file)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const analyzeFailedPayment = async (transactionData) => {
  // Force strict JSON output so the frontend never breaks
  const model = genAI.getGenerativeModel({ 
    model: "gemini-3.5-flash",
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
    You are an expert AI Revenue Recovery Agent for a payment gateway.
    Analyze the following failed transaction and decide the best recovery action.
    
    TRANSACTION DATA:
    - Amount: ${transactionData.amount} INR
    - Failure Reason: ${transactionData.failureReason}
    - Past Successful Payments: ${transactionData.pastSuccessfulPayments}

    DECISION LOGIC:
    - If it's a temporary network/gateway issue, recommend "RETRY".
    - If it's a user error (insufficient funds, incorrect CVV) OR they have high past successful payments, recommend "PAYMENT_LINK".
    - If it's a hard failure (card expired, card declined, fraud) and they have 0 past payments, recommend "ESCALATE".

    OUTPUT FORMAT:
    You must return a valid JSON object EXACTLY like this:
    {
      "action": "RETRY" | "PAYMENT_LINK" | "ESCALATE",
      "reason": "A one-sentence explanation of why you chose this action based on the data."
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText); 
  } catch (error) {
    console.error('❌ AI Analysis Failed:', error);
    return { action: 'ESCALATE', reason: 'AI analysis failed, human review required.' }; // Safe fallback
  }
};

module.exports = { analyzeFailedPayment };