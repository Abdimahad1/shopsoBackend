import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxLength: [50, "Category name cannot exceed 50 characters"],
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

// 🔥 REMOVE OR MODIFY: Make name unique per user, not globally
// Remove this unique constraint:
// categorySchema.index({ name: 1 }, { unique: true });

// Instead, add compound index for unique name per user
categorySchema.index({ name: 1, createdBy: 1 }, { unique: true });

// Virtual field for product count
categorySchema.virtual("productCount", {
  ref: "Product",
  localField: "_id",
  foreignField: "category",
  count: true,
});

export default mongoose.model("Category", categorySchema);