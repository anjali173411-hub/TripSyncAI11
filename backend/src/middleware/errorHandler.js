export function errorHandler(error, req, res, next) {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body." });
  }

  if (error.code === "ER_CHECK_CONSTRAINT_VIOLATED" || error.errno === 4025) {
    return res.status(400).json({ message: "Validation failed." });
  }

  console.error(error);

  res.status(500).json({
    message: "Internal server error.",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
}
