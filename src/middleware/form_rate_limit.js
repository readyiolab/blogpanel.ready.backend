const rateLimit = require('express-rate-limit');

const limiter = (limit, windowMs) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again in a few minutes.' },
  });

// Public website forms (contact, booking, newsletter).
const formLimiter = limiter(10, 15 * 60 * 1000);

// Chatbot messages are more frequent than form submissions.
const chatLimiter = limiter(40, 5 * 60 * 1000);

module.exports = { formLimiter, chatLimiter };
