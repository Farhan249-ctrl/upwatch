function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err.errors) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      return res.status(400).json({ error: err.message || 'Validation error' });
    }
  };
}

module.exports = {
  validate,
};
