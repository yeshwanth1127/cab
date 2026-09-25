const maintenance = (req, res, next) => {
  const MAINTENANCE_MODE = false;

  // Allow admin routes if needed
  if (req.path.startsWith('/admin')) {
    return next();
  }

  if (MAINTENANCE_MODE) {
    return res.status(503).json({
      message: "Service temporarily unavailable. Please try again later."
    });
  }

  next();
};

module.exports = maintenance;
