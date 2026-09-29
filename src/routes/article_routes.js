const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { verifyToken, authorize, verifyOwnership } = require('../middleware/rbac_middleware');
const { cacheMiddleware } = require('../middleware/cache_middleware');
const rateLimit = require('express-rate-limit');

const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// ==================== PUBLIC ROUTES ====================

// Internal admin/editor article listing
router.get(
  '/manage',
  verifyToken,
  authorize('view_all_articles'),
  articleController.getAdminArticles
);

// Internal single article by id
router.get(
  '/id/:id',
  verifyToken,
  articleController.getArticleById
);

// Get all published articles (with pagination, optional ?category=<slug>)
router.get('/', cacheMiddleware(600), articleController.getAllArticles);

// Slugs of every published article (for sitemaps)
router.get('/slugs', cacheMiddleware(600), articleController.getPublishedSlugs);

// Get user's own articles
router.get('/my-articles', verifyToken, articleController.getMyArticles);

// Get single article by slug (SEO-friendly)
router.get('/slug/:slug', cacheMiddleware(1800), articleController.getArticleBySlug);

// Count a page view (not cached)
router.post('/slug/:slug/view', viewLimiter, articleController.recordView);

// Get articles by category
router.get('/category/:slug', cacheMiddleware(900), articleController.getArticlesByCategory);

// Search articles
router.get('/search', cacheMiddleware(300), articleController.searchArticles);

// Get trending articles
router.get('/trending', cacheMiddleware(1800), articleController.getTrendingArticles);

// Get featured articles
router.get('/featured', cacheMiddleware(3600), articleController.getFeaturedArticles);

// ==================== PROTECTED ROUTES ====================

// Create article (Reporter, Author, Editor, Admin)
router.post(
  '/',
  verifyToken,
  authorize('create_article'),
  articleController.createArticle
);

// Edit article (Author can edit own, Editor/Admin can edit all)
router.put(
  '/:id',
  verifyToken,
  authorize('edit_article'),
  verifyOwnership('article'),
  articleController.editArticle
);

// Delete article (Author can delete own drafts, Editor/Admin can delete any)
router.delete(
  '/:id',
  verifyToken,
  authorize('delete_article'),
  verifyOwnership('article'),
  articleController.deleteArticle
);

// Publish article (Editor, Admin only)
router.put(
  '/:id/publish',
  verifyToken,
  authorize('publish_article'),
  verifyOwnership('article'),
  articleController.publishArticle
);

module.exports = router;
