const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicleController");

// Get all vehicles
router.get("/", vehicleController.getVehicles);

// Add new vehicle
router.post("/", vehicleController.createVehicle);

// Update vehicle info
router.put("/:id", vehicleController.updateVehicle);

// Delete vehicle
router.delete("/:id", vehicleController.deleteVehicle);

//Add vehicle to blacklist
router.put("/:id/blacklist", vehicleController.blacklistVehicle);

// Add vehicle to whitelist
router.put("/:id/whitelist", vehicleController.whitelistVehicle);


module.exports = router;