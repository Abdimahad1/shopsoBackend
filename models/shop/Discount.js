import mongoose from "mongoose";

const discountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Discount name is required"],
      trim: true,
      maxLength: [100, "Discount name cannot exceed 100 characters"],
    },
    code: {
      type: String,
      required: [true, "Discount code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      maxLength: [20, "Discount code cannot exceed 20 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxLength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
      required: true,
    },
    value: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    image: {
      type: String,
      default: null,
    },
    minOrder: {
      type: Number,
      min: [0, "Minimum order cannot be negative"],
      default: 0,
    },
    maxDiscount: {
      type: Number,
      min: [0, "Maximum discount cannot be negative"],
      default: 0,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    usageLimit: {
      type: Number,
      min: [1, "Usage limit must be at least 1"],
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"],
    },
    remainingUses: {
      type: Number,
      default: null,
    },
    customerType: {
      type: String,
      enum: ["all", "new", "returning", "vip"],
      default: "all",
    },
    appliesTo: {
      type: String,
      enum: ["all_products", "selected_categories", "selected_products"],
      default: "all_products",
    },
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    }],
    products: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    }],
    oneTimeUse: {
      type: Boolean,
      default: false,
    },
    combineWithOther: {
      type: Boolean,
      default: true,
    },
    excludeSaleItems: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "upcoming", "expired", "paused"],
      default: "active",
    },
    revenueGenerated: {
      type: Number,
      default: 0,
      min: [0, "Revenue cannot be negative"],
    },
    ordersUsed: {
      type: Number,
      default: 0,
      min: [0, "Orders used cannot be negative"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ================================
// VIRTUAL PROPERTIES (UNCHANGED)
// ================================

discountSchema.virtual("daysRemaining").get(function() {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

discountSchema.virtual("usagePercentage").get(function() {
  if (!this.usageLimit) return 0;
  return Math.round((this.usedCount / this.usageLimit) * 100);
});

discountSchema.virtual("isActive").get(function() {
  const now = new Date();
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  return now >= start && now <= end && this.status === "active";
});

// ================================
// ⚠️ CRITICAL FIX: MONGOOSE 9+ MIDDLEWARE
// ================================

// ❌ REMOVE THIS (OLD MONGOOSE <9):
// discountSchema.pre("save", function(next) {
//   // ... code
//   next();
// });

// ✅ ADD THIS (MONGOOSE 9+):
discountSchema.pre("save", async function() {
  // Calculate remaining uses
  if (this.usageLimit !== null && this.usageLimit !== undefined) {
    const usageLimit = Number(this.usageLimit);
    const usedCount = Number(this.usedCount) || 0;
    
    if (!isNaN(usageLimit) && !isNaN(usedCount)) {
      this.remainingUses = Math.max(0, usageLimit - usedCount);
    } else {
      this.remainingUses = null;
    }
  } else {
    this.remainingUses = null;
  }

  // Update status based on dates (only if not manually paused)
  if (this.status !== "paused") {
    const now = new Date();
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    if (now < start) {
      this.status = "upcoming";
    } else if (now > end) {
      this.status = "expired";
    } else {
      this.status = "active";
    }
  }
});

// ================================
// INDEXES (UNCHANGED)
// ================================

discountSchema.index({ code: 1 });
discountSchema.index({ createdBy: 1 });
discountSchema.index({ status: 1 });
discountSchema.index({ startDate: 1, endDate: 1 });
discountSchema.index({ createdAt: -1 });

// ================================
// STATIC METHOD (UNCHANGED)
// ================================

discountSchema.statics.isValidCode = async function(code, shopOwnerId) {
  const discount = await this.findOne({ 
    code: code.toUpperCase(),
    createdBy: shopOwnerId 
  });
  
  if (!discount) return null;
  
  // Check if discount is still valid
  const now = new Date();
  const start = new Date(discount.startDate);
  const end = new Date(discount.endDate);
  
  if (now < start || now > end || discount.status !== "active") {
    return null;
  }
  
  // Check usage limits
  if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
    return null;
  }
  
  return discount;
};

export default mongoose.model("Discount", discountSchema);