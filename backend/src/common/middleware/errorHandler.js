function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.statusCode || 500;
  if (process.env.NODE_ENV !== 'test' || status >= 500) {
    console.error('Unhandled request error:', err);
  }
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
}

module.exports = {
  errorHandler,
};
