const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateExpress } = require('../auth');

// POST detection event from Python AI (protected)
router.post('/detection/event', authenticateExpress, analyticsController.postEvent);

// Analytics endpoints
router.get('/summary', authenticateExpress, analyticsController.getSummary);
router.get('/live', authenticateExpress, analyticsController.getLive);
router.get('/history', authenticateExpress, analyticsController.getHistory);

module.exports = router;