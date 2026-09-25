const rateLimit = require("express-rate-limit");

// Shared response for blocked requests
const rateLimitHandler = (req, res) => {
  return res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later."
  });
};

// Strict limiter for login and registration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per IP in 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again after 15 minutes."
  }
});

// Stricter limiter for sensitive admin actions
const adminActionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // max 5 requests per IP in 10 mins
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: {
    success: false,
    message: "Too many sensitive requests. Please wait before trying again."
  }
});

module.exports = {
  authLimiter,
  adminActionLimiter
};
