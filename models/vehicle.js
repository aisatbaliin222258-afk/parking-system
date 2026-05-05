const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {   
    plate_number: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    owner: {
      type: String,
      default: "Unknown",
      trim: true,
    },

    type: {
      type: String,
      default: "Sedan",
    },

    color: {
      type: String,
      default: "Unknown",
    },

    status: {
      type: String,
      enum: ["normal", "whitelisted", "blacklisted"],
      default: "normal",
    },

    reason: {
      type: String, // reason for blacklist (optional)
      default: "",
    },
  },
  {
    timestamps: true, // auto create createdAt & updatedAt
  }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);