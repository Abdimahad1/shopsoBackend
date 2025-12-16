import multer from "multer";
import path from "path";
import fs from "fs";

// ================================
// PATHS
// ================================

const UPLOADS_BASE = "uploads";
const STORES_UPLOADS = path.join(UPLOADS_BASE, "stores");
const LOGOS_UPLOADS = path.join(STORES_UPLOADS, "logos");
const BANNERS_UPLOADS = path.join(STORES_UPLOADS, "banners");

// ================================
// DIRECTORY INITIALIZATION
// ================================

const initializeUploadDirectories = () => {
  try {
    [STORES_UPLOADS, LOGOS_UPLOADS, BANNERS_UPLOADS].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${path.resolve(dir)}`);
      }
    });
  } catch (error) {
    console.error(`❌ Failed to create directories:`, error.message);
    throw error;
  }
};

initializeUploadDirectories();

// ================================
// FILE FILTER - FIXED VERSION
// ================================

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.svg'];
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ];

  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check if extension is allowed
  const isExtensionValid = allowedExtensions.includes(ext);
  
  // Check if MIME type is allowed
  const isMimeTypeValid = allowedMimeTypes.includes(file.mimetype);

  console.log(`📁 File upload check:`);
  console.log(`   Original name: ${file.originalname}`);
  console.log(`   Extension: ${ext}`);
  console.log(`   MIME type: ${file.mimetype}`);
  console.log(`   Valid extension: ${isExtensionValid}`);
  console.log(`   Valid MIME: ${isMimeTypeValid}`);

  if (isExtensionValid && isMimeTypeValid) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed.`), false);
  }
};

// ================================
// STORAGE CONFIGURATION
// ================================

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOGOS_UPLOADS);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `logo-${userId}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BANNERS_UPLOADS);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `banner-${userId}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// ================================
// MULTER INSTANCES
// ================================

export const uploadLogo = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: fileFilter
}).single("logo");

export const uploadBanner = multer({
  storage: bannerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter
}).single("bannerImage");

// Main upload middleware for store images
export const uploadStoreImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'logo') {
        cb(null, LOGOS_UPLOADS);
      } else if (file.fieldname === 'bannerImage') {
        cb(null, BANNERS_UPLOADS);
      } else {
        cb(new Error('Invalid fieldname'), false);
      }
    },
    filename: (req, file, cb) => {
      const userId = req.user?.id || 'unknown';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase();
      const prefix = file.fieldname === 'logo' ? 'logo' : 'banner';
      const filename = `${prefix}-${userId}-${uniqueSuffix}${ext}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
  fileFilter: fileFilter
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]);

// ================================
// UTILITY FUNCTIONS
// ================================

export const deleteLogo = async (filename) => {
  try {
    if (!filename) return false;
    const safeFilename = path.basename(filename);
    const filePath = path.join(LOGOS_UPLOADS, safeFilename);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`🗑️ Deleted store logo: ${safeFilename}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error deleting store logo ${filename}:`, error.message);
    return false;
  }
};

export const deleteBanner = async (filename) => {
  try {
    if (!filename) return false;
    const safeFilename = path.basename(filename);
    const filePath = path.join(BANNERS_UPLOADS, safeFilename);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`🗑️ Deleted store banner: ${safeFilename}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error deleting store banner ${filename}:`, error.message);
    return false;
  }
};

export const getStoreImageUrl = (req, filename, type = "logo") => {
  if (!filename) return null;
  const safeFilename = path.basename(filename);
  const folder = type === "banner" ? "banners" : "logos";
  return `${req.protocol}://${req.get("host")}/uploads/stores/${folder}/${safeFilename}`;
};