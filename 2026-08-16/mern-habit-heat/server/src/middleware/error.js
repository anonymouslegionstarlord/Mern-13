export function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.name === "ValidationError") {
    const details = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: "Validation failed", details });
  }

  if (error.name === "CastError") {
    return res.status(400).json({ message: "Invalid habit id" });
  }

  console.error(error);
  return res.status(error.status || 500).json({ message: error.message || "Server error" });
}

