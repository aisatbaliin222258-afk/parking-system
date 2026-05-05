const Event = require("../models/event");

// GET ALL EVENTS
exports.getEvents = async (req, res) => {
    try {
        const events = await Event.find().sort({ createdAt: -1 });
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// CREATE EVENT (optional, for testing or AI input)
exports.createEvent = async (req, res) => {
    try {
        const { type, severity, location, plate } = req.body;

        if (!type || !severity || !location) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const event = new Event({
            type,
            severity,
            location,
            plate
        });

        await event.save();
        res.status(201).json(event);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// RESOLVE EVENT
exports.resolveEvent = async (req, res) => {
    try {
        const { id } = req.params;

        const event = await Event.findById(id);

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        if (event.status === "Resolved") {
            return res.status(400).json({ message: "Already resolved" });
        }

        event.status = "Resolved";
        await event.save();

        // Notify connected clients about resolved event (minimal, non-breaking)
        try{
            const socket = require('../socket');
            const io = socket.getIO && socket.getIO();
            if (io && typeof io.emit === 'function'){
                io.emit('event_resolved', { _id: event._id, camera_id: event.camera_id || event.cameraId || null, status: event.status });
            }
        }catch(e){ console.warn('Event resolve: socket emit failed', e); }

        res.json(event);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};