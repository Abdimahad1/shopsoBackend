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
import storeRoutes from "./routes/shop/storeRoutes.js";
import fs from "fs";

dotenv.config();
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ================================
// CORS CONFIGURATION FOR DEPLOYMENT
// ================================

// List of allowed origins
const allowedOrigins = [
  'https://shopso.onrender.com',  // Your frontend
  'http://localhost:5173',        // Local Vite dev server
  'http://localhost:3000',        // Local React dev server
  'http://localhost:5174',        // Alternate local port
];

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log(`Blocked by CORS: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

// Enable CORS for all routes with detailed logging in development
if (process.env.NODE_ENV === 'production') {
  app.use(cors(corsOptions));
} else {
  // In development, allow all origins for easier testing
  app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }));
  console.log('⚠️  Development mode: CORS set to allow all origins');
}

// Handle preflight requests for all routes
app.options(/.*/, (req, res) => {
  res.header(
    'Access-Control-Allow-Origin',
    process.env.NODE_ENV === 'production'
      ? 'https://shopso.onrender.com'
      : '*'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});


// Log CORS requests in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
    next();
  });
}

// ================================
// MIDDLEWARE
// ================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ================================
// UPLOADS DIRECTORY SETUP
// ================================

// Create unified uploads directory
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PRODUCTS_UPLOADS = path.join(UPLOADS_DIR, "products");
const DISCOUNTS_UPLOADS = path.join(UPLOADS_DIR, "discounts");
const STORES_UPLOADS = path.join(UPLOADS_DIR, "stores");
const LOGOS_UPLOADS = path.join(STORES_UPLOADS, "logos");
const BANNERS_UPLOADS = path.join(STORES_UPLOADS, "banners");

// Create directories if they don't exist
const createUploadsDirectories = () => {
  try {
    const directories = [
      UPLOADS_DIR,
      PRODUCTS_UPLOADS,
      DISCOUNTS_UPLOADS,
      STORES_UPLOADS,
      LOGOS_UPLOADS,
      BANNERS_UPLOADS
    ];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
    
    console.log('📁 All upload directories ready');
  } catch (error) {
    console.error('❌ Failed to create directories:', error.message);
  }
};

createUploadsDirectories();

// ================================
// STATIC FILE SERVING WITH CORS
// ================================

// Helper function to set image headers with CORS
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
      res.setHeader('Content-Type', 'application/octet-stream');
      break;
  }
  
  // Cache control for images
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' ? 'https://shopso.onrender.com' : '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

// Serve static files with CORS headers
const staticOptions = {
  setHeaders: (res, filePath) => {
    setImageHeaders(res, filePath);
  }
};

app.use("/uploads/products", express.static(PRODUCTS_UPLOADS, staticOptions));
app.use("/uploads/discounts", express.static(DISCOUNTS_UPLOADS, staticOptions));
app.use("/uploads/stores/logos", express.static(LOGOS_UPLOADS, staticOptions));
app.use("/uploads/stores/banners", express.static(BANNERS_UPLOADS, staticOptions));

// ================================
// HEALTH CHECK AND ROOT ENDPOINT
// ================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🛍️ ShopSo Backend API is running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development',
    frontend_url: "https://shopso.onrender.com",
    backend_url: "https://shopsobackend.onrender.com",
    status: "operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      categories: "/api/categories",
      discounts: "/api/discounts",
      stores: "/api/stores"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "✅ Server is healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    node_version: process.version
  });
});

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

  // Debug route for store logos
  app.get("/debug/image/stores/logos/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(LOGOS_UPLOADS, filename);
    debugImageFile(res, filename, filePath, "store logos");
  });

  // Debug route for store banners
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
        res.setHeader('Access-Control-Allow-Origin', '*');
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
app.use("/api/stores", storeRoutes);

// ================================
// ERROR HANDLING
// ================================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler:", err);

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: "CORS policy: Origin not allowed",
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin
    });
  }

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
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ================================
// SERVER START
// ================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │                                             │
  │   🛍️  ShopSo Backend Server Started        │
  │                                             │
  └─────────────────────────────────────────────┘
  
  📊 Server Information:
     Port: ${PORT}
     Environment: ${process.env.NODE_ENV || 'development'}
     Frontend URL: https://shopso.onrender.com
     Backend URL: https://shopsobackend.onrender.com
  
  📁 Uploads Directory: ${UPLOADS_DIR}
  
  🌐 API Endpoints:
     Base URL: http://localhost:${PORT}/api
     Auth: http://localhost:${PORT}/api/auth
     Products: http://localhost:${PORT}/api/products
     Categories: http://localhost:${PORT}/api/categories
     Discounts: http://localhost:${PORT}/api/discounts
     Stores: http://localhost:${PORT}/api/stores
  
  📸 Image URLs (Production):
     Products: https://shopsobackend.onrender.com/uploads/products/
     Discounts: https://shopsobackend.onrender.com/uploads/discounts/
     Store Logos: https://shopsobackend.onrender.com/uploads/stores/logos/
     Store Banners: https://shopsobackend.onrender.com/uploads/stores/banners/
  
  ✅ Server is ready to accept connections!
  `);
  
  // Verify all directories exist
  createUploadsDirectories();
});