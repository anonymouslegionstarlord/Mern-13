export function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation failed",
      details: Object.values(error.errors).map((item) => item.message),
    });
  }
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid defect id" });
  console.error(error);
  return res.status(error.status || 500).json({ message: error.message || "Unexpected server error" });
}

