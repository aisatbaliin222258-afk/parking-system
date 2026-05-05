const express = require("express");
const router = express.Router();
const eventController = require('../controllers/eventController');


// GET ALL EVENTS
router.get("/", eventController.getEvents);

// CREATE EVENT
router.post("/", eventController.createEvent);

// RESOLVE EVENT
router.post("/:id/resolve", eventController.resolveEvent);

module.exports = router;