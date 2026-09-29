const articleService = require('../services/articleService');
const { clearCache } = require('../middleware/cache_middleware');
const { notifyArticleChange } = require('../services/revalidate');

const clampPage = (value) => Math.max(parseInt(value, 10) || 1, 1);
const clampLimit = (value, fallback = 10) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), 50);

// Get all published articles
exports.getAllArticles = async (req, res) => {
  try {
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit, 10);
    const offset = (page - 1) * limit;
    const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : null;

    const { articles, totalCount } = await articleService.getAllArticles(limit, offset, category);

    res.json({
      success: true,
      data: articles,
      pagination: {
        currentPage: page,
        limit,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ success: false, message: 'Error fetching articles' });
  }
};

// Slugs + last-modified dates of every published article (for sitemaps)
exports.getPublishedSlugs = async (req, res) => {
  try {
    const slugs = await articleService.getPublishedSlugs();
    res.json({ success: true, data: slugs });
  } catch (error) {
    console.error('Error fetching article slugs:', error);
    res.status(500).json({ success: false, message: 'Error fetching article slugs' });
  }
};

exports.getAdminArticles = async (req, res) => {
  try {
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const status = req.query.status || null;

    const { articles, totalCount } = await articleService.getAdminArticles({
      limit,
      offset,
      status,
    });

    res.json({
      success: true,
      data: articles,
      pagination: {
        currentPage: page,
        limit,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admin articles:', error);
    res.status(500).json({ success: false, message: 'Error fetching articles' });
  }
};

// Get user's own articles
exports.getMyArticles = async (req, res) => {
  try {
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit, 10);
    const offset = (page - 1) * limit;

    const { articles, totalCount } = await articleService.getMyArticles(req.user.id, limit, offset);

    res.json({
      success: true,
      data: articles,
      pagination: {
        currentPage: page,
        limit,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching my articles:', error);
    res.status(500).json({ success: false, message: 'Error fetching my articles' });
  }
};

// Get single article by slug. Old slugs answer with { movedTo } so clients can redirect.
exports.getArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const article = await articleService.getArticleDetails(slug);

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    if (article.movedTo) {
      return res.json({ success: true, movedTo: article.movedTo });
    }

    res.json({ success: true, data: article });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ success: false, message: 'Error fetching article' });
  }
};

// Count a page view (called by the blog page in the browser)
exports.recordView = async (req, res) => {
  try {
    const counted = await articleService.recordView(req.params.slug);
    res.status(counted ? 204 : 404).end();
  } catch (error) {
    console.error('Error recording article view:', error);
    res.status(500).json({ success: false, message: 'Error recording view' });
  }
};

exports.getArticleById = async (req, res) => {
  try {
    const article = await articleService.getArticleById(req.params.id, req.user);

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    res.json({ success: true, data: article });
  } catch (error) {
    console.error('Error fetching article by id:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error fetching article' });
  }
};

// Get articles by category
exports.getArticlesByCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit, 10);
    const offset = (page - 1) * limit;

    const { articles, totalCount } = await articleService.getArticlesByCategory(slug, limit, offset);

    res.json({
      success: true,
      data: articles,
      pagination: {
        currentPage: page,
        limit,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching category articles:', error);
    res.status(500).json({ success: false, message: 'Error fetching category articles' });
  }
};

// Search articles
exports.searchArticles = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
    }

    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit, 10);
    const offset = (page - 1) * limit;

    const articles = await articleService.searchArticles(q, limit, offset);
    res.json({ success: true, data: articles });
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).json({ success: false, message: 'Error searching articles' });
  }
};

// Get trending articles
exports.getTrendingArticles = async (req, res) => {
  try {
    const articles = await articleService.getTrendingArticles(10);
    res.json({ success: true, data: articles });
  } catch (error) {
    console.error('Error fetching trending articles:', error);
    res.status(500).json({ success: false, message: 'Error fetching trending articles' });
  }
};

// Get featured articles
exports.getFeaturedArticles = async (req, res) => {
  try {
    const articles = await articleService.getFeaturedArticles(5);
    res.json({ success: true, data: articles });
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ success: false, message: 'Error fetching featured articles' });
  }
};

// Create article
exports.createArticle = async (req, res) => {
  try {
    const { title, content, categoryId } = req.body;
    if (!title || !content || !categoryId) {
      return res.status(400).json({ success: false, message: 'Title, content, and category are required' });
    }

    const result = await articleService.createArticle(req.body, req.user.id);

    await clearCache();
    notifyArticleChange({ slug: result.slug });

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ success: false, message: 'Error creating article' });
  }
};

// Edit article
exports.editArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await articleService.updateArticle(id, req.body, req.user.id);
    await clearCache();
    notifyArticleChange({ slug: result.slug, oldSlug: result.oldSlug });
    res.json({ success: true, message: 'Article updated successfully', data: result });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error updating article' });
  }
};

// Delete article
exports.deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await articleService.deleteArticle(id, req.user.id);
    await clearCache();
    notifyArticleChange({ slug: result.slug });
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(error.statusCode || (error.message.includes('admins') ? 403 : 500)).json({
      success: false,
      message: error.message || 'Error deleting article',
    });
  }
};

// Publish article
exports.publishArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await articleService.publishArticle(id, req.user.id);
    await clearCache();
    notifyArticleChange({ slug: result.slug });
    res.json({ success: true, message: 'Article published successfully' });
  } catch (error) {
    console.error('Error publishing article:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error publishing article' });
  }
};

module.exports = exports;
