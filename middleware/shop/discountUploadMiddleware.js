import multer from "multer";
import path from "path";
import fs from "fs";

// ================================
// ✅ CONSISTENT PATH - Project root uploads
// ================================

const UPLOADS_BASE = "uploads"; // Relative to project root
const DISCOUNTS_UPLOADS = path.join(UPLOADS_BASE, "discounts");

// ================================
// DIRECTORY INITIALIZATION
// ================================

// Ensure upload directory exists on module load
const initializeUploadDirectory = () => {
  try {
    const absolutePath = path.resolve(DISCOUNTS_UPLOADS);
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
      console.log(`✅ Created discount upload directory: ${absolutePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to create discount upload directory: ${error.message}`);
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
    const absolutePath = path.resolve(DISCOUNTS_UPLOADS);
    // Double-check directory exists
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }
    cb(null, absolutePath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `discount-${uniqueSuffix}${ext}`);
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

// Multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit
  },
  fileFilter: fileFilter,
});

// ================================
// MIDDLEWARE EXPORTS
// ================================

// Middleware for discount images
export const uploadDiscountImage = upload.single("image");

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Delete a file from the discount uploads directory
 */
export const deleteFile = async (filename) => {
  try {
    if (!filename) return false;
    
    const safeFilename = path.basename(filename);
    const filePath = path.resolve(DISCOUNTS_UPLOADS, safeFilename);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`🗑️ Deleted discount file: ${safeFilename}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error deleting discount file ${filename}:`, error.message);
    return false;
  }
};

/**
 * Get the full URL for a discount image
 */
export const getImageUrl = (req, filename) => {
  if (!filename) return null;
  const safeFilename = path.basename(filename);
  return `${req.protocol}://${req.get("host")}/uploads/discounts/${safeFilename}`;
};

/**
 * Get the absolute filesystem path for a discount image
 */
export const getFilePath = (filename) => {
  if (!filename) return null;
  const safeFilename = path.basename(filename);
  return path.resolve(DISCOUNTS_UPLOADS, safeFilename);
};

/**
 * Check if a discount image file exists
 */
export const fileExists = (filename) => {
  try {
    if (!filename) return false;
    const safeFilename = path.basename(filename);
    const filePath = path.resolve(DISCOUNTS_UPLOADS, safeFilename);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error(`❌ Error checking discount file ${filename}:`, error.message);
    return false;
  }
};