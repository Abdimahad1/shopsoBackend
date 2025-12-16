import Store from "../../models/shop/Store.js";
import Product from "../../models/shop/Product.js";
import { deleteLogo, deleteBanner, getStoreImageUrl } from "../../middleware/shop/storeUpload.js";

// Helper to get full image URLs
const getStoreWithImages = (store, req) => {
  if (!store) return null;
  
  const storeObj = store.toObject ? store.toObject() : { ...store };
  
  if (storeObj.logo) {
    storeObj.logoUrl = getStoreImageUrl(req, storeObj.logo, "logo");
  }
  
  if (storeObj.bannerImage) {
    storeObj.bannerUrl = getStoreImageUrl(req, storeObj.bannerImage, "banner");
  }
  
  return storeObj;
};

/* ============================================================
   CREATE STORE
============================================================ */
export const createStore = async (req, res) => {
  try {
    console.log("=== CREATE STORE ===");
    console.log("User ID:", req.user.id);
    
    // Check if user already has a store
    const existingStore = await Store.findOne({ createdBy: req.user.id });
    if (existingStore) {
      return res.status(400).json({
        success: false,
        message: "You already have a store. Each user can only have one store.",
      });
    }
    
    const {
      name,
      tagline,
      description,
      email,
      phone,
      address,
      established,
    } = req.body;
    
    // Only name is required
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Store name is required",
      });
    }
    
    // Parse social links if provided
    let socialLinks = {
      facebook: "",
      instagram: "",
      twitter: "",
      website: ""
    };
    
    try {
      if (req.body.socialLinks) {
        const parsedLinks = typeof req.body.socialLinks === 'string' 
          ? JSON.parse(req.body.socialLinks)
          : req.body.socialLinks;
        
        socialLinks = {
          ...socialLinks,
          ...parsedLinks
        };
      }
    } catch (error) {
      console.log("Error parsing social links:", error.message);
    }
    
    const storeData = {
      name,
      tagline: tagline || "",
      description: description || "",
      email: email || "",
      phone: phone || "",
      address: address || "",
      established: established || new Date().getFullYear(),
      socialLinks,
      createdBy: req.user.id,
    };
    
    // Handle uploaded files
    if (req.files?.logo) {
      console.log("📁 Logo file uploaded:", req.files.logo[0].filename);
      storeData.logo = req.files.logo[0].filename;
    }
    
    if (req.files?.bannerImage) {
      console.log("📁 Banner file uploaded:", req.files.bannerImage[0].filename);
      storeData.bannerImage = req.files.bannerImage[0].filename;
    }
    
    console.log("📝 Creating store with data:", storeData);
    
    const store = await Store.create(storeData);
    console.log("✅ Store created:", store.name);
    
    res.status(201).json({
      success: true,
      message: "Store created successfully",
      data: getStoreWithImages(store, req),
    });
  } catch (error) {
    console.error("❌ Create Store Error:", error);
    
    // Clean up uploaded files on error
    if (req.files?.logo) {
      await deleteLogo(req.files.logo[0].filename);
    }
    if (req.files?.bannerImage) {
      await deleteBanner(req.files.bannerImage[0].filename);
    }
    
    res.status(500).json({
      success: false,
      message: "Error creating store",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ============================================================
   GET MY STORE
============================================================ */
export const getMyStore = async (req, res) => {
  try {
    console.log("=== GET MY STORE ===");
    console.log("User ID:", req.user.id);
    
    const store = await Store.findOne({ createdBy: req.user.id });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found. Please create a store first.",
      });
    }
    
    // Get store statistics
    const productCount = await Product.countDocuments({ createdBy: req.user.id });
    const activeProducts = await Product.countDocuments({ 
      createdBy: req.user.id,
      stock: { $gt: 0 }
    });
    
    const storeWithImages = getStoreWithImages(store, req);
    
    const storeWithStats = {
      ...storeWithImages,
      statistics: {
        ...store.statistics,
        productCount,
        activeProducts,
      },
    };
    
    console.log("✅ Store found:", store.name);
    
    res.json({
      success: true,
      data: storeWithStats,
    });
  } catch (error) {
    console.error("❌ Get Store Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching store",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ============================================================
   UPDATE STORE
============================================================ */
export const updateStore = async (req, res) => {
  try {
    console.log("=== UPDATE STORE ===");
    console.log("User ID:", req.user.id);
    
    const store = await Store.findOne({ createdBy: req.user.id });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }
    
    // Build update data
    const updateData = {};
    
    // List of basic fields we accept from frontend
    const basicFields = [
      'name', 
      'tagline', 
      'description', 
      'email', 
      'phone', 
      'address', 
      'established'
    ];
    
    // Update basic fields
    basicFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        updateData[field] = req.body[field];
      }
    });
    
    // Handle social links if provided
    if (req.body.socialLinks) {
      try {
        const parsedLinks = typeof req.body.socialLinks === 'string' 
          ? JSON.parse(req.body.socialLinks)
          : req.body.socialLinks;
        
        updateData.socialLinks = {
          ...store.socialLinks,
          ...parsedLinks
        };
      } catch (error) {
        console.log("Error parsing social links:", error.message);
      }
    }
    
    // Handle uploaded files
    if (req.files?.logo) {
      console.log("📁 New logo uploaded:", req.files.logo[0].filename);
      // Delete old logo
      if (store.logo) {
        await deleteLogo(store.logo);
      }
      updateData.logo = req.files.logo[0].filename;
    }
    
    if (req.files?.bannerImage) {
      console.log("📁 New banner uploaded:", req.files.bannerImage[0].filename);
      // Delete old banner
      if (store.bannerImage) {
        await deleteBanner(store.bannerImage);
      }
      updateData.bannerImage = req.files.bannerImage[0].filename;
    }
    
    console.log("📝 Updating store with:", updateData);
    
    // Update store
    const updatedStore = await Store.findOneAndUpdate(
      { createdBy: req.user.id },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );
    
    if (!updatedStore) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }
    
    console.log("✅ Store updated:", updatedStore.name);
    
    res.json({
      success: true,
      message: "Store updated successfully",
      data: getStoreWithImages(updatedStore, req),
    });
  } catch (error) {
    console.error("❌ Update Store Error:", error);
    
    // Clean up uploaded files on error
    if (req.files?.logo) {
      await deleteLogo(req.files.logo[0].filename);
    }
    if (req.files?.bannerImage) {
      await deleteBanner(req.files.bannerImage[0].filename);
    }
    
    res.status(500).json({
      success: false,
      message: "Error updating store",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ============================================================
   UPDATE ONLY SOCIAL LINKS
============================================================ */
export const updateSocialLinks = async (req, res) => {
  try {
    console.log("=== UPDATE SOCIAL LINKS ===");
    console.log("User ID:", req.user.id);
    
    const { socialLinks } = req.body;
    
    if (!socialLinks) {
      return res.status(400).json({
        success: false,
        message: "Social links data is required",
      });
    }
    
    const updatedStore = await Store.findOneAndUpdate(
      { createdBy: req.user.id },
      { socialLinks },
      { new: true, runValidators: true }
    );
    
    if (!updatedStore) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }
    
    res.json({
      success: true,
      message: "Social links updated successfully",
      data: getStoreWithImages(updatedStore, req),
    });
  } catch (error) {
    console.error("❌ Update Social Links Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating social links",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ============================================================
   GET PUBLIC STORE
============================================================ */
export const getPublicStore = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const store = await Store.findOne({ 
      createdBy: userId,
      isActive: true 
    });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found or is inactive",
      });
    }
    
    // Get public store data (exclude sensitive info)
    const publicStore = {
      _id: store._id,
      name: store.name,
      tagline: store.tagline,
      description: store.description,
      email: store.email,
      phone: store.phone,
      address: store.address,
      established: store.established,
      yearsActive: new Date().getFullYear() - store.established,
      socialLinks: store.socialLinks,
      isVerified: store.isVerified,
      createdAt: store.createdAt,
    };
    
    // Add image URLs
    if (store.logo) {
      publicStore.logoUrl = getStoreImageUrl(req, store.logo, "logo");
    }
    
    if (store.bannerImage) {
      publicStore.bannerUrl = getStoreImageUrl(req, store.bannerImage, "banner");
    }
    
    // Get store products count
    const productCount = await Product.countDocuments({ 
      createdBy: userId,
      stock: { $gt: 0 }
    });
    
    publicStore.productCount = productCount;
    
    res.json({
      success: true,
      data: publicStore,
    });
  } catch (error) {
    console.error("❌ Get Public Store Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching store",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ============================================================
   DELETE STORE
============================================================ */
export const deleteStore = async (req, res) => {
  try {
    console.log("=== DELETE STORE ===");
    console.log("User ID:", req.user.id);
    
    const store = await Store.findOne({ createdBy: req.user.id });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }
    
    // Delete associated images
    if (store.logo) {
      await deleteLogo(store.logo);
    }
    
    if (store.bannerImage) {
      await deleteBanner(store.bannerImage);
    }
    
    // Delete the store
    await Store.findByIdAndDelete(store._id);
    
    console.log("🗑️ Store deleted:", store.name);
    
    res.json({
      success: true,
      message: "Store deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete Store Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting store",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};