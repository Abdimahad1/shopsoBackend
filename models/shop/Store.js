import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
    },
    tagline: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    established: {
      type: Number,
      default: new Date().getFullYear(),
      min: 1900,
      max: new Date().getFullYear(),
    },
    logo: {
      type: String,
      default: null,
    },
    bannerImage: {
      type: String,
      default: null,
    },
    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      website: { type: String, default: "" },
    },
    statistics: {
      totalOrders: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      customerCount: { type: Number, default: 0 },
      productCount: { type: Number, default: 0 },
      activeProducts: { type: Number, default: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One store per user
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes
storeSchema.index({ name: 1 });
storeSchema.index({ createdBy: 1 }, { unique: true });
storeSchema.index({ isVerified: 1 });
storeSchema.index({ isActive: 1 });

const Store = mongoose.model("Store", storeSchema);

export default Store;