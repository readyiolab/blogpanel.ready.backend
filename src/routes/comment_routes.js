const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { verifyToken, authorize } = require('../middleware/rbac_middleware');

router.get('/article/:articleId', commentController.getComments);
router.post('/', verifyToken, commentController.addComment);

// Admin routes
router.get('/admin', verifyToken, authorize('manage_comments'), commentController.getAllComments);
router.put('/:id/approve', verifyToken, authorize('manage_comments'), commentController.approveComment);
router.put('/:id/reject', verifyToken, authorize('manage_comments'), commentController.rejectComment);
router.delete('/:id', verifyToken, authorize('manage_comments'), commentController.deleteComment);

module.exports = router;
