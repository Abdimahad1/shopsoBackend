import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/shop/productRoutes.js";
import categoryRoutes from "./routes/shop/categoryRoutes.js";
import discountRoutes from "./routes/shop/discountRoutes.js";
import storeRoutes from "./routes/shop/storeRoutes.js"; // NEW
import fs from "fs";

dotenv.config();
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// ================================
// SINGLE UPLOADS DIRECTORY SETUP
// ================================

// Create unified uploads directory
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PRODUCTS_UPLOADS = path.join(UPLOADS_DIR, "products");
const DISCOUNTS_UPLOADS = path.join(UPLOADS_DIR, "discounts");
const STORES_UPLOADS = path.join(UPLOADS_DIR, "stores"); // NEW
const LOGOS_UPLOADS = path.join(STORES_UPLOADS, "logos"); // NEW
const BANNERS_UPLOADS = path.join(STORES_UPLOADS, "banners"); // NEW

// Create directories if they don't exist
const createUploadsDirectories = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log("📁 Created main uploads directory:", UPLOADS_DIR);
  }
  
  if (!fs.existsSync(PRODUCTS_UPLOADS)) {
    fs.mkdirSync(PRODUCTS_UPLOADS, { recursive: true });
    console.log("📁 Created products uploads directory:", PRODUCTS_UPLOADS);
  }
  
  if (!fs.existsSync(DISCOUNTS_UPLOADS)) {
    fs.mkdirSync(DISCOUNTS_UPLOADS, { recursive: true });
    console.log("📁 Created discounts uploads directory:", DISCOUNTS_UPLOADS);
  }
  
  // NEW: Create store directories
  if (!fs.existsSync(STORES_UPLOADS)) {
    fs.mkdirSync(STORES_UPLOADS, { recursive: true });
    console.log("📁 Created stores uploads directory:", STORES_UPLOADS);
  }
  
  if (!fs.existsSync(LOGOS_UPLOADS)) {
    fs.mkdirSync(LOGOS_UPLOADS, { recursive: true });
    console.log("📁 Created store logos directory:", LOGOS_UPLOADS);
  }
  
  if (!fs.existsSync(BANNERS_UPLOADS)) {
    fs.mkdirSync(BANNERS_UPLOADS, { recursive: true });
    console.log("📁 Created store banners directory:", BANNERS_UPLOADS);
  }
};

createUploadsDirectories();

// ================================
// STATIC FILE SERVING
// ================================

// Serve product images from single uploads directory
app.use("/uploads/products", express.static(PRODUCTS_UPLOADS, {
  setHeaders: (res, filePath) => {
    setImageHeaders(res, filePath);
  }
}));

// Serve discount images from single uploads directory
app.use("/uploads/discounts", express.static(DISCOUNTS_UPLOADS, {
  setHeaders: (res, filePath) => {
    setImageHeaders(res, filePath);
  }
}));

// NEW: Serve store logos
app.use("/uploads/stores/logos", express.static(LOGOS_UPLOADS, {
  setHeaders: (res, filePath) => {
    setImageHeaders(res, filePath);
  }
}));

// NEW: Serve store banners
app.use("/uploads/stores/banners", express.static(BANNERS_UPLOADS, {
  setHeaders: (res, filePath) => {
    setImageHeaders(res, filePath);
  }
}));

// Helper function to set image headers
const setImageHeaders = (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  
  // Set correct Content-Type based on file extension
  switch (ext) {
    case '.webp':
      res.setHeader('Content-Type', 'image/webp');
      break;
    case '.png':
      res.setHeader('Content-Type', 'image/png');
      break;
    case '.gif':
      res.setHeader('Content-Type', 'image/gif');
      break;
    case '.svg':
      res.setHeader('Content-Type', 'image/svg+xml');
      break;
    case '.jpg':
    case '.jpeg':
      res.setHeader('Content-Type', 'image/jpeg');
      break;
    default:
      // For unknown types, let Express handle it
      break;
  }
  
  // Cache control
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
};

// ================================
// DEBUG ROUTES (Development only)
// ================================

if (process.env.NODE_ENV === "development") {
  // Debug route to check uploads directory structure
  app.get("/debug/uploads", (req, res) => {
    try {
      const uploadsInfo = {
        mainDirectory: UPLOADS_DIR,
        exists: fs.existsSync(UPLOADS_DIR),
        products: {
          path: PRODUCTS_UPLOADS,
          exists: fs.existsSync(PRODUCTS_UPLOADS),
          files: fs.existsSync(PRODUCTS_UPLOADS) ? 
            fs.readdirSync(PRODUCTS_UPLOADS).filter(f => !f.startsWith('.')).length : 0
        },
        discounts: {
          path: DISCOUNTS_UPLOADS,
          exists: fs.existsSync(DISCOUNTS_UPLOADS),
          files: fs.existsSync(DISCOUNTS_UPLOADS) ? 
            fs.readdirSync(DISCOUNTS_UPLOADS).filter(f => !f.startsWith('.')).length : 0
        },
        stores: {
          path: STORES_UPLOADS,
          exists: fs.existsSync(STORES_UPLOADS),
          logos: {
            path: LOGOS_UPLOADS,
            exists: fs.existsSync(LOGOS_UPLOADS),
            files: fs.existsSync(LOGOS_UPLOADS) ? 
              fs.readdirSync(LOGOS_UPLOADS).filter(f => !f.startsWith('.')).length : 0
          },
          banners: {
            path: BANNERS_UPLOADS,
            exists: fs.existsSync(BANNERS_UPLOADS),
            files: fs.existsSync(BANNERS_UPLOADS) ? 
              fs.readdirSync(BANNERS_UPLOADS).filter(f => !f.startsWith('.')).length : 0
          }
        }
      };
      
      res.json({
        success: true,
        message: "Uploads directory info",
        data: uploadsInfo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error checking uploads directory",
        error: error.message
      });
    }
  });

  // Debug route for product images
  app.get("/debug/image/products/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(PRODUCTS_UPLOADS, filename);
    debugImageFile(res, filename, filePath, "products");
  });

  // Debug route for discount images
  app.get("/debug/image/discounts/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(DISCOUNTS_UPLOADS, filename);
    debugImageFile(res, filename, filePath, "discounts");
  });

  // NEW: Debug route for store logos
  app.get("/debug/image/stores/logos/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(LOGOS_UPLOADS, filename);
    debugImageFile(res, filename, filePath, "store logos");
  });

  // NEW: Debug route for store banners
  app.get("/debug/image/stores/banners/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(BANNERS_UPLOADS, filename);
    debugImageFile(res, filename, filePath, "store banners");
  });

  // Helper function for image debugging
  const debugImageFile = (res, filename, filePath, type) => {
    console.log(`🔍 Debug ${type} image check:`);
    console.log("  Filename:", filename);
    console.log("  Full path:", filePath);
    
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        console.log("  ✅ File exists");
        console.log("  File size:", stats.size, "bytes");
        console.log("  Last modified:", stats.mtime);
        
        const ext = path.extname(filePath).toLowerCase();
        let contentType = "image/jpeg";
        
        if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.svg') contentType = 'image/svg+xml';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        
        res.setHeader('Content-Type', contentType);
        res.sendFile(filePath);
      } catch (error) {
        console.log("  ❌ Error reading file:", error.message);
        res.status(500).json({
          success: false,
          message: `Error reading ${type} image: ${filename}`,
          error: error.message
        });
      }
    } else {
      console.log("  ❌ File NOT found");
      res.status(404).json({
        success: false,
        message: `${type} file not found: ${filename}`,
        path: filePath
      });
    }
  };
}

// ================================
// API ROUTES
// ================================

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/stores", storeRoutes); // NEW

// ================================
// ERROR HANDLING
// ================================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);

  // Multer errors
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected file field",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(", "),
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  // Duplicate key error (MongoDB)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// ================================
// SERVER START
// ================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT ${PORT}`);
  console.log(`📁 Main uploads directory: ${UPLOADS_DIR}`);
  console.log(`📁 Products images: ${PRODUCTS_UPLOADS}`);
  console.log(`📁 Discounts images: ${DISCOUNTS_UPLOADS}`);
  console.log(`📁 Store logos: ${LOGOS_UPLOADS}`);
  console.log(`📁 Store banners: ${BANNERS_UPLOADS}`);
  console.log(`🌐 Product images URL: http://localhost:${PORT}/uploads/products/`);
  console.log(`🌐 Discount images URL: http://localhost:${PORT}/uploads/discounts/`);
  console.log(`🌐 Store logos URL: http://localhost:${PORT}/uploads/stores/logos/`);
  console.log(`🌐 Store banners URL: http://localhost:${PORT}/uploads/stores/banners/`);
  
  // Verify all directories exist
  createUploadsDirectories();
});