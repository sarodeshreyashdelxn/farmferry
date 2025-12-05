/**
 * Async handler to avoid try-catch blocks in route handlers
 * @param {Function} requestHandler - Express request handler
 * @returns {Function} - Express middleware function
 */
export const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
