const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, authorize } = require('../middleware/rbac_middleware');

router.get('/dashboard', verifyToken, authorize('view_analytics'), adminController.getDashboard);
router.get('/analytics', verifyToken, authorize('view_analytics'), adminController.getStats);
router.get('/logs', verifyToken, authorize('view_activity_logs'), adminController.getLogs);
router.get('/newsletter-subscribers', verifyToken, authorize('manage_users'), adminController.getNewsletterSubscribers);


module.exports = router;
