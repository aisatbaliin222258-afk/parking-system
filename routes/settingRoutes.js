const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const { authenticateExpress } = require('../auth');

// Change password - requires auth
router.put('/change-password/:userId', authenticateExpress, settingController.changePassword);

// Generic routes - require auth for update/delete, allow get for profile viewing (but can require auth if desired)
router.get('/:userId', authenticateExpress, settingController.getUser);
router.put('/:userId', authenticateExpress, settingController.updateAccount);
router.delete('/:userId', authenticateExpress, settingController.deleteAccount);

module.exports = router;