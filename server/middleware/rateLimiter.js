import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many requests. Please try again in a minute.',
    limit: 5,
    window: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.phone || req.body.From || req.ip;
  }
});

export const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    return req.body.phoneNumber || req.body.From || req.ip;
  }
});
