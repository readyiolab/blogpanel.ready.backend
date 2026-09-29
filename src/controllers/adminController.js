const db = require('../models/database');

exports.getDashboard = async (req, res) => {
    try {
        const data = await db.getDashboardStatsForUser(req.user);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStats = async (req, res) => {
    try {
        const articleCount = await db.queryAll('SELECT COUNT(*) as count FROM tbl_articles');
        const userCount = await db.queryAll('SELECT COUNT(*) as count FROM tbl_users');
        const viewCount = await db.queryAll('SELECT COALESCE(SUM(views_count), 0) as count FROM tbl_articles');
        const commentCount = await db.queryAll("SELECT COUNT(*) as count FROM tbl_comments WHERE status = 'pending'");
        res.json({
            success: true,
            data: {
                total_articles: articleCount[0].count || 0,
                total_users: userCount[0].count || 0,
                total_views: viewCount[0].count || 0,
                total_comments: commentCount[0].count || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLogs = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
        const offset = (page - 1) * limit;
        const [logs, totalRows] = await Promise.all([
            db.getActivityLogs(limit, offset),
            db.queryAll('SELECT COUNT(*) AS count FROM tbl_activity_logs'),
        ]);
        res.json({
            success: true,
            data: logs,
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

exports.getNewsletterSubscribers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
        const offset = (page - 1) * limit;
        const [subscribers, totalRows] = await Promise.all([
            db.queryAll(
                `SELECT id, email, first_name, status, is_verified, verified_at, created_at
                 FROM tbl_newsletter_subscribers
                 ORDER BY created_at DESC
                 LIMIT ? OFFSET ?`,
                [limit, offset]
            ),
            db.queryAll('SELECT COUNT(*) AS count FROM tbl_newsletter_subscribers'),
        ]);
        res.json({
            success: true,
            data: subscribers,
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
