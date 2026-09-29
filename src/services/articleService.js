const db = require('../config/database');
const { destroyUploadedImage } = require('../config/cloudinary');

// Paths the blog app serves itself; an article slug may never shadow them.
const RESERVED_SLUGS = new Set(['category', 'feed.xml', 'sitemap.xml', 'robots.txt', 'api', 'page', 'search']);
const WORDS_PER_MINUTE = 200;

const stripHtml = (html = '') =>
    String(html)
        .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const computeReadingTime = (html) => {
    const words = stripHtml(html).split(' ').filter(Boolean).length;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
};

const parseTags = (tags) => {
    if (tags === undefined || tags === null) return undefined;
    if (Array.isArray(tags)) return tags;
    return String(tags).split(',');
};

const toBool = (value) => value === true || value === 1 || value === '1' || value === 'true';

const optionalString = (value, maxLength) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed.substring(0, maxLength) : null;
};

class ArticleService {
    async resolveUniqueSlug(rawSlug, excludeId = null) {
        let base = db.generateSlug(rawSlug || '').substring(0, 200);
        if (!base) base = 'article';
        if (RESERVED_SLUGS.has(base)) base = `${base}-article`;

        let slug = base;
        let counter = 1;
        while (
            (await db.isSlugExists(slug, excludeId)) ||
            (await db.isSlugInHistory(slug, excludeId))
        ) {
            slug = `${base}-${counter}`;
            counter++;
        }
        return slug;
    }

    async getRoleName(userId) {
        const rows = await db.queryAll(
            `SELECT r.role_name FROM tbl_users u
       JOIN tbl_roles r ON u.role_id = r.id WHERE u.id = ?`,
            [userId]
        );
        return rows[0]?.role_name || null;
    }

    resolveStatusForRole(roleName, requestedStatus) {
        if (roleName === 'Admin' || roleName === 'Editor') {
            return requestedStatus === 'draft' ? 'draft' : 'published';
        }
        if (roleName === 'Reporter') {
            return requestedStatus === 'draft' ? 'draft' : 'pending';
        }
        if (roleName === 'Author') {
            return requestedStatus === 'published' ? 'published' : 'draft';
        }
        return 'draft';
    }

    async getAdminArticles({ limit, offset, status }) {
        const { rows, totalCount } = await db.getArticlesForAdmin({ limit, offset, status });
        return {
            articles: rows,
            totalCount
        };
    }

    async getAllArticles(limit, offset, categorySlug = null) {
        const [articles, totalCount] = await Promise.all([
            db.getPublishedArticles(limit, offset, categorySlug),
            db.countPublishedArticles(categorySlug),
        ]);
        return { articles, totalCount };
    }

    async getPublishedSlugs() {
        return db.getPublishedSlugs();
    }

    async getMyArticles(userId, limit, offset) {
        const articles = await db.queryAll(
            `SELECT 
        a.id, a.title, a.slug, a.excerpt,
        a.featured_image, a.featured_image_alt,
        a.views_count, a.reading_time,
        a.is_featured, a.is_trending, a.published_at, a.status,
        c.category_name, c.slug as category_slug,
        u.id as author_id, u.username as author_name, u.username, u.first_name, u.last_name
      FROM tbl_articles a
      JOIN tbl_categories c ON a.category_id = c.id
      JOIN tbl_users u ON a.author_id = u.id
      WHERE a.author_id = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        const totalCount = await db.queryAll(
            "SELECT COUNT(*) as count FROM tbl_articles WHERE author_id = ?",
            [userId]
        );
        return {
            articles,
            totalCount: totalCount[0].count
        };
    }

    /**
     * Public article by slug. Returns:
     *   - null when nothing matches
     *   - { movedTo } when the slug is an old one (caller should redirect permanently)
     *   - the article with author, tags, gallery, related and prev/next otherwise
     */
    async getArticleDetails(slug) {
        const rows = await db.queryAll(
            `SELECT a.id, a.title, a.slug, a.excerpt, a.content,
                a.featured_image, a.featured_image_alt,
                a.category_id, a.status,
                a.meta_title, a.meta_description, a.meta_keywords, a.canonical_url,
                a.faq_json, a.schema_type,
                a.views_count, a.reading_time, a.is_featured,
                a.published_at, a.created_at, a.updated_at,
                c.category_name, c.slug AS category_slug,
                u.id AS author_id, u.username AS author_username, u.first_name, u.last_name,
                u.profile_image AS author_image, u.bio AS author_bio, u.author_title,
                u.twitter_url, u.linkedin_url, u.website_url
         FROM tbl_articles a
         LEFT JOIN tbl_categories c ON a.category_id = c.id
         LEFT JOIN tbl_users u ON a.author_id = u.id
         WHERE a.slug = ? AND a.status = 'published'
         LIMIT 1`,
            [slug]
        );

        const article = rows[0];
        if (!article) {
            const movedTo = await db.getCurrentSlugForOldSlug(slug);
            return movedTo ? { movedTo } : null;
        }

        const [tags, gallery, related, adjacent] = await Promise.all([
            db.getTagsForArticle(article.id),
            db.queryAll(
                'SELECT id, image_url, alt_text, caption FROM tbl_gallery WHERE article_id = ? ORDER BY display_order',
                [article.id]
            ).catch(() => []),
            db.getRelatedArticles(article.id, article.category_id, 3),
            db.getAdjacentArticles(article.id, article.published_at || article.created_at),
        ]);

        const fullName = [article.first_name, article.last_name].filter(Boolean).join(' ').trim();

        return {
            ...article,
            is_featured: Boolean(article.is_featured),
            reading_time: article.reading_time || computeReadingTime(article.content),
            author_name: fullName || article.author_username,
            tags,
            gallery,
            related,
            prev: adjacent.prev,
            next: adjacent.next,
        };
    }

    async recordView(slug) {
        const result = await db.query(
            "UPDATE tbl_articles SET views_count = views_count + 1 WHERE slug = ? AND status = 'published'",
            [slug]
        );
        return result.affectedRows > 0;
    }

    async getArticleById(articleId, currentUser) {
        const article = await db.getArticleByIdForAdmin(articleId);
        if (!article) {
            return null;
        }

        const isPrivileged = currentUser.role === 'Admin' || currentUser.role === 'Editor';
        if (!isPrivileged && article.author_id !== currentUser.id) {
            const error = new Error('You do not have access to this article');
            error.statusCode = 403;
            throw error;
        }

        return article;
    }

    async getArticlesByCategory(slug, limit, offset) {
        const [articles, totalCount] = await Promise.all([
            db.getArticlesByCategory(slug, limit, offset),
            db.getArticlesByCategoryCount(slug),
        ]);

        return { articles, totalCount };
    }

    async searchArticles(searchTerm, limit, offset) {
        return await db.searchArticles(searchTerm, limit, offset);
    }

    async getTrendingArticles(limit) {
        return await db.getTrendingArticles(limit);
    }

    async getFeaturedArticles(limit) {
        return await db.getFeaturedArticles(limit);
    }

    async resolveCategoryId(requestedId) {
        let validCategory = null;

        if (requestedId) {
            validCategory = await db.select('tbl_categories', 'id', 'id = ?', [requestedId]);
        }
        if (!validCategory) {
            validCategory = await db.select('tbl_categories', 'id', 'status = ?', ['active']);
        }
        if (!validCategory) {
            validCategory = await db.select('tbl_categories', 'id', '1=1');
        }
        if (validCategory) {
            return validCategory.id;
        }

        const newCat = await db.insert('tbl_categories', {
            category_name: 'General',
            slug: 'general',
            description: 'General category for articles',
            status: 'active'
        });
        return newCat.insert_id;
    }

    async createArticle(data, userId) {
        const slug = await this.resolveUniqueSlug(data.slug || data.title);
        const roleName = await this.getRoleName(userId);
        const status = this.resolveStatusForRole(roleName, data.status);
        const categoryId = await this.resolveCategoryId(data.categoryId);

        let subCategoryId = data.subCategoryId || null;
        if (subCategoryId) {
            const validSubCat = await db.select('tbl_sub_categories', 'id', 'id = ?', [subCategoryId]);
            if (!validSubCat) {
                subCategoryId = null;
            }
        }

        const excerpt = (data.excerpt || '').trim();
        const articleData = {
            title: data.title.trim(),
            slug,
            excerpt,
            content: data.content,
            featured_image: data.imageUrl || null,
            featured_image_alt: optionalString(data.imageAlt, 255) ?? null,
            category_id: categoryId,
            sub_category_id: subCategoryId,
            author_id: userId,
            status,
            meta_title: (optionalString(data.metaTitle, 160) || data.title.trim()).substring(0, 160),
            meta_description: (optionalString(data.metaDescription, 160) || excerpt).substring(0, 160),
            meta_keywords: optionalString(data.metaKeywords, 255) ?? null,
            canonical_url: optionalString(data.canonicalUrl, 255) ?? null,
            is_featured: toBool(data.isFeatured),
            reading_time: computeReadingTime(data.content),
            published_at: status === 'published'
                ? (data.publishedAt ? new Date(data.publishedAt) : new Date())
                : null,
        };

        await db.beginTransaction();
        try {
            const result = await db.insert('tbl_articles', articleData);
            const tags = parseTags(data.tags);
            if (tags) {
                await db.setArticleTags(result.insert_id, tags);
            }

            await db.logActivity(
                userId,
                'create_article',
                'article',
                result.insert_id,
                `Created article: ${articleData.title}`
            );

            await db.commit();
            return { id: result.insert_id, slug, status };
        } catch (error) {
            await db.rollback();
            throw error;
        }
    }

    async updateArticle(id, data, userId) {
        const current = await db.select('tbl_articles', '*', 'id = ?', [id]);
        if (!current) {
            const error = new Error('Article not found');
            error.statusCode = 404;
            throw error;
        }

        const updateData = {};
        const wasPublic = current.status === 'published' || Boolean(current.published_at);

        if (data.title) {
            updateData.title = data.title.trim();
            updateData.meta_title = data.title.trim().substring(0, 160);
        }

        // Published URLs stay stable: the slug only changes when explicitly edited,
        // or when an unpublished draft is renamed.
        let newSlug = current.slug;
        if (data.slug && db.generateSlug(data.slug) !== current.slug) {
            newSlug = await this.resolveUniqueSlug(data.slug, id);
        } else if (!data.slug && data.title && !wasPublic && data.title.trim() !== current.title) {
            newSlug = await this.resolveUniqueSlug(data.title, id);
        }
        if (newSlug !== current.slug) {
            updateData.slug = newSlug;
        }

        if (data.excerpt !== undefined) updateData.excerpt = String(data.excerpt || '').trim();
        if (data.content) {
            updateData.content = data.content;
            updateData.reading_time = computeReadingTime(data.content);
        }
        if (data.categoryId) {
            const validCat = await db.select('tbl_categories', 'id', 'id = ?', [data.categoryId]);
            if (validCat) {
                updateData.category_id = data.categoryId;
            }
        }
        if (data.subCategoryId) {
            const validSubCat = await db.select('tbl_sub_categories', 'id', 'id = ?', [data.subCategoryId]);
            if (validSubCat) {
                updateData.sub_category_id = data.subCategoryId;
            }
        }
        if (data.imageUrl !== undefined) updateData.featured_image = data.imageUrl || null;
        if (data.imageAlt !== undefined) updateData.featured_image_alt = optionalString(data.imageAlt, 255);
        if (data.metaTitle) updateData.meta_title = data.metaTitle.trim().substring(0, 160);
        if (data.metaDescription !== undefined) {
            updateData.meta_description = optionalString(data.metaDescription, 160)
                || (updateData.excerpt ?? current.excerpt ?? '').substring(0, 160);
        }
        if (data.metaKeywords !== undefined) updateData.meta_keywords = optionalString(data.metaKeywords, 255);
        if (data.canonicalUrl !== undefined) updateData.canonical_url = optionalString(data.canonicalUrl, 255);
        if (data.isFeatured !== undefined) updateData.is_featured = toBool(data.isFeatured);

        if (data.status) {
            const roleName = await this.getRoleName(userId);
            updateData.status = this.resolveStatusForRole(roleName, data.status);
            if (updateData.status === 'published' && !current.published_at) {
                updateData.published_at = new Date();
            }
        }

        let oldImageToDelete = null;
        if (data.imageUrl !== undefined && current.featured_image && current.featured_image !== data.imageUrl) {
            oldImageToDelete = current.featured_image;
        }

        await db.beginTransaction();
        try {
            if (Object.keys(updateData).length > 0) {
                await db.update('tbl_articles', updateData, 'id = ?', [id]);
            }
            if (updateData.slug && wasPublic) {
                await db.recordSlugChange(id, current.slug, updateData.slug);
            }
            const tags = parseTags(data.tags);
            if (tags) {
                await db.setArticleTags(id, tags);
            }
            await db.logActivity(userId, 'edit_article', 'article', id, 'Updated article');
            await db.commit();
        } catch (error) {
            await db.rollback();
            throw error;
        }

        if (oldImageToDelete) {
            destroyUploadedImage(oldImageToDelete);
        }

        return {
            slug: newSlug,
            oldSlug: newSlug !== current.slug ? current.slug : null,
            status: updateData.status || current.status,
        };
    }

    async deleteArticle(id, userId) {
        const article = await db.select('tbl_articles', '*', 'id = ?', [id]);
        if (!article) {
            const error = new Error('Article not found');
            error.statusCode = 404;
            throw error;
        }
        if (article.status === 'published') {
            const roleName = await this.getRoleName(userId);
            if (roleName !== 'Admin' && roleName !== 'Editor') {
                throw new Error('Only admins and editors can delete published articles');
            }
        }

        await db.beginTransaction();
        try {
            await db.delete('tbl_articles', 'id = ?', [id]);
            await db.logActivity(userId, 'delete_article', 'article', id, 'Deleted article');
            await db.commit();
        } catch (error) {
            await db.rollback();
            throw error;
        }

        destroyUploadedImage(article.featured_image);
        return { slug: article.slug };
    }

    async publishArticle(id, userId) {
        await db.beginTransaction();
        try {
            await db.query(
                "UPDATE tbl_articles SET status = 'published', published_at = COALESCE(published_at, NOW()) WHERE id = ?",
                [id]
            );
            await db.logActivity(userId, 'publish_article', 'article', id, 'Published article');
            await db.commit();
        } catch (error) {
            await db.rollback();
            throw error;
        }
        const article = await db.select('tbl_articles', 'slug', 'id = ?', [id]);
        return { slug: article?.slug || null };
    }

    async getUserArticles(userId, limit, offset) {
        return await db.queryAll(
            `SELECT id, title, slug, status, views_count, published_at, created_at
       FROM tbl_articles
       WHERE author_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
    }
}

module.exports = new ArticleService();
