import jwt from "jsonwebtoken";

export function authenticate(secretOrOptions) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Authentication token required"
      });
    }

    const token = authHeader.split(" ")[1];
    const secret =
      typeof secretOrOptions === "string"
        ? secretOrOptions
        : secretOrOptions?.secret || process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      return res.status(500).json({
        status: "error",
        message: "JWT secret not configured"
      });
    }

    try {
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired token"
      });
    }
  };
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden: insufficient permissions"
      });
    }
    next();
  };
}
