import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ------------------------------
// MAIN AUTH MIDDLEWARE
// ------------------------------
export const protect = async (req, res, next) => {
  let token;

  try {
    // Check Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Also check for token in cookies (if you use cookies)
    // if (!token && req.cookies?.token) {
    //   token = req.cookies.token;
    // }

    // No token provided
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please log in to continue.",
        code: "NO_TOKEN"
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user (exclude password for security)
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found or has been deactivated.",
        code: "USER_NOT_FOUND"
      });
    }

    // Attach user to request object with all user info
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      // Add any other user fields you need
    };
    
    next();
    
  } catch (error) {
    console.error("🔒 Auth Middleware Error:", error.name, error.message);

    // Specific error handling for better client feedback
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
        code: "INVALID_TOKEN"
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
        code: "TOKEN_EXPIRED"
      });
    }

    // Generic error
    return res.status(401).json({
      success: false,
      message: "Authentication failed. Please log in again.",
      code: "AUTH_FAILED"
    });
  }
};

// ------------------------------
// ROLE-BASED ACCESS
// ------------------------------
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "NO_USER"
      });
    }

    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempts (for security monitoring)
      console.warn(`⛔ Unauthorized role access attempt: User ${req.user.id} (${req.user.role}) tried to access ${req.method} ${req.originalUrl}`);

      return res.status(403).json({
        success: false,
        message: `Access denied. ${req.user.role}s cannot perform this action.`,
        code: "ROLE_DENIED",
        requiredRoles: roles,
        userRole: req.user.role
      });
    }
    next();
  };
};

// ------------------------------
// OWNERSHIP CHECK MIDDLEWARE (NEW)
// ------------------------------
export const checkOwnership = (modelName, idParam = "id") => {
  return async (req, res, next) => {
    try {
      const Model = require(`../models/${modelName}.js`).default || require(`../models/${modelName}.js`);
      const resource = await Model.findById(req.params[idParam]);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: `${modelName} not found.`,
          code: "NOT_FOUND"
        });
      }

      // Admin can access anything
      if (req.user.role === "admin") {
        return next();
      }

      // Check if the current user owns this resource
      if (resource.createdBy.toString() !== req.user.id) {
        console.warn(`⚠️ Ownership violation: User ${req.user.id} tried to access ${modelName} ${req.params[idParam]} owned by ${resource.createdBy}`);
        
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource.",
          code: "NOT_OWNER"
        });
      }

      next();
    } catch (error) {
      console.error(`Ownership check error for ${modelName}:`, error);
      return res.status(500).json({
        success: false,
        message: "Error checking resource ownership.",
        code: "OWNERSHIP_CHECK_FAILED"
      });
    }
  };
};

// ------------------------------
// ADMIN ONLY MIDDLEWARE (SHORTHAND)
// ------------------------------
export const adminOnly = authorizeRoles("admin");

// ------------------------------
// SHOP OWNER ONLY MIDDLEWARE (SHORTHAND)
// ------------------------------
export const shopOwnerOnly = authorizeRoles("shopOwner");