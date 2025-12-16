import multer from "multer";
import path from "path";
import fs from "fs";

// ================================
// ✅ CONSISTENT PATH - Project root uploads
// ================================

const UPLOADS_BASE = "uploads"; // Relative to project root
const PRODUCTS_UPLOADS = path.join(UPLOADS_BASE, "products");

// ================================
// DIRECTORY INITIALIZATION
// ================================

// Ensure upload directory exists on module load
const initializeUploadDirectory = () => {
  try {
    const absolutePath = path.resolve(PRODUCTS_UPLOADS);
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
      console.log(`✅ Created product upload directory: ${absolutePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to create product upload directory: ${error.message}`);
    throw error;
  }
};

initializeUploadDirectory();

// ================================
// MULTER CONFIGURATION
// ================================

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const absolutePath = path.resolve(PRODUCTS_UPLOADS);
    // Double-check directory exists
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }
    cb(null, absolutePath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only images are allowed (jpeg, jpg, png, webp, gif)"));
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// ================================
// MIDDLEWARE EXPORTS
// ================================

// Middleware for product images
export const uploadProductImages = upload.fields([
  { name: "frontImage", maxCount: 1 },
  { name: "backImage", maxCount: 1 },
]);

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Delete a file from the product uploads directory
 */
export const deleteFile = async (filename) => {
  try {
    if (!filename) return false;
    
    const safeFilename = path.basename(filename);
    const filePath = path.resolve(PRODUCTS_UPLOADS, safeFilename);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`🗑️ Deleted product file: ${safeFilename}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error deleting product file ${filename}:`, error.message);
    return false;
  }
};

/**
 * Get the full URL for a product image
 */
export const getImageUrl = (req, filename) => {
  if (!filename) return null;
  const safeFilename = path.basename(filename);
  return `${req.protocol}://${req.get("host")}/uploads/products/${safeFilename}`;
};

/**
 * Get the absolute filesystem path for a product image
 */
export const getFilePath = (filename) => {
  if (!filename) return null;
  const safeFilename = path.basename(filename);
  return path.resolve(PRODUCTS_UPLOADS, safeFilename);
};

/**
 * Check if a product image file exists
 */
export const fileExists = (filename) => {
  try {
    if (!filename) return false;
    const safeFilename = path.basename(filename);
    const filePath = path.resolve(PRODUCTS_UPLOADS, safeFilename);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error(`❌ Error checking product file ${filename}:`, error.message);
    return false;
  }
};