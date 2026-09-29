const db = require('../models/database');
const { clearCache } = require('../middleware/cache_middleware');

exports.getComments = async (req, res) => {
    try {
        const { articleId } = req.params;
        const comments = await db.getCommentsByArticle(articleId);
        res.json({ success: true, data: comments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { articleId, content } = req.body;
        if (!articleId || !content || !String(content).trim()) {
            return res.status(400).json({ success: false, message: 'Article and comment content are required' });
        }

        const article = await db.select('tbl_articles', 'id', 'id = ?', [articleId]);
        if (!article) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }

        await db.beginTransaction();
        const result = await db.insert('tbl_comments', {
            article_id: articleId,
            user_id: req.user.id,
            comment_text: String(content).trim(),
            status: 'pending'
        });
        await db.commit();
        await clearCache('*');
        res.status(201).json({ success: true, data: { id: result.insert_id } });
    } catch (error) {
        try { await db.rollback(); } catch (e) { }
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllComments = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
        const offset = (page - 1) * limit;
        const [comments, totalRows] = await Promise.all([
            db.getCommentsForAdmin(limit, offset),
            db.queryAll('SELECT COUNT(*) AS count FROM tbl_comments'),
        ]);
        res.json({
            success: true,
            data: comments,
            pagination: {
                currentPage: page,
                limit,
                totalRecords: totalRows[0]?.count || 0,
                totalPages: Math.ceil((totalRows[0]?.count || 0) / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.approveComment = async (req, res) => {
    try {
        const { id } = req.params;
        await db.update('tbl_comments', { status: 'approved' }, 'id = ?', [id]);
        await clearCache('*');
        res.json({ success: true, message: 'Comment approved' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.rejectComment = async (req, res) => {
    try {
        const { id } = req.params;
        await db.update('tbl_comments', { status: 'rejected' }, 'id = ?', [id]);
        await clearCache('*');
        res.json({ success: true, message: 'Comment rejected' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        await db.delete('tbl_comments', 'id = ?', [id]);
        await clearCache('*');
        res.json({ success: true, message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
