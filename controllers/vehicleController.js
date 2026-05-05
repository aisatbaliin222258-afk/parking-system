const Vehicle = require("../models/vehicle");

// Get all vehicles
exports.getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 });
    res.status(200).json(vehicles);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch vehicles", error: err.message });
  }
};

//  Add new vehicle
exports.createVehicle = async (req, res) => {
  try {
    const { plate_number, owner, type, color, status, reason } = req.body;

    const existingVehicle = await Vehicle.findOne({ plate_number });
    if (existingVehicle) {
      return res.status(400).json({ message: "Vehicle already exists" });
    }

    const vehicle = new Vehicle({
      plate_number,
      owner,
      type,
      color,
      status: status || "normal",
      reason: reason || "",
    });

    await vehicle.save();
    res.status(201).json({ message: "Vehicle added successfully", vehicle });
  } catch (err) {
    res.status(500).json({ message: "Failed to add vehicle", error: err.message });
  }
};

//  Update vehicle info
exports.updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { owner, type, color, status, reason } = req.body;

    const vehicle = await Vehicle.findByIdAndUpdate(
      id,
      { owner, type, color, status, reason },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.status(200).json({ message: "Vehicle updated", vehicle });
  } catch (err) {
    res.status(500).json({ message: "Failed to update vehicle", error: err.message });
  }
};

//  Delete vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findByIdAndDelete(id);

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.status(200).json({ message: "Vehicle deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete vehicle", error: err.message });
  }
};

//  Add vehicle to blacklist
exports.blacklistVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const vehicle = await Vehicle.findByIdAndUpdate(
      id,
      { status: "blacklisted", reason: reason || "No reason provided" },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.status(200).json({ message: "Vehicle blacklisted", vehicle });
  } catch (err) {
    res.status(500).json({ message: "Failed to blacklist vehicle", error: err.message });
  }
};

//  Add vehicle to whitelist
exports.whitelistVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findByIdAndUpdate(
      id,
      { status: "whitelisted", reason: "" },
      { new: true }
    );

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.status(200).json({ message: "Vehicle whitelisted", vehicle });
  } catch (err) {
    res.status(500).json({ message: "Failed to whitelist vehicle", error: err.message });
  }
};