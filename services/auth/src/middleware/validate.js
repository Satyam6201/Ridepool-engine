export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issues = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message
      }));

      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: issues
      });
    }

    req.body = result.data;
    next();
  };
}
