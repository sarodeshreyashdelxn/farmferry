/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Log full error to console for debugging (except during tests)
  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }
  
  // Default error response
  const errorResponse = {
    status: "error",
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  };

  // Handle specific error types
  if (err.name === "ValidationError") {
    // Mongoose validation error
    errorResponse.status = "fail";
    errorResponse.message = Object.values(err.errors).map(val => val.message).join(', ');
    return res.status(400).json(errorResponse);
  }
  
  if (err.name === "CastError") {
    // Mongoose invalid ID error
    errorResponse.status = "fail";
    errorResponse.message = `Invalid ${err.path}: ${err.value}`;
    return res.status(400).json(errorResponse);
  }
  
  if (err.code === 11000) {
    // Mongoose duplicate key error
    errorResponse.status = "fail";
    errorResponse.message = `Duplicate field value: ${Object.keys(err.keyValue).join(', ')}. Please use another value.`;
    return res.status(400).json(errorResponse);
  }
  
  if (err.name === "JsonWebTokenError") {
    // JWT error
    errorResponse.status = "fail";
    errorResponse.message = "Invalid token. Please log in again.";
    return res.status(401).json(errorResponse);
  }
  
  if (err.name === "TokenExpiredError") {
    // JWT expired error
    errorResponse.status = "fail";
    errorResponse.message = "Your token has expired. Please log in again.";
    return res.status(401).json(errorResponse);
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export default errorHandler;
