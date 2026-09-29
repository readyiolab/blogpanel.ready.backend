const db = require('../models/database');
const { blogSiteUrl } = require('../config/dotenvConfig');

const toDate = (value) => (value ? new Date(value) : new Date()).toISOString().split('T')[0];

const escapeXml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const urlEntry = (loc, lastmod, changefreq, priority) =>
    `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;

exports.generateSitemap = async (req, res) => {
    try {
        const base = blogSiteUrl.replace(/\/$/, '');
        const categories = await db.queryAll(`
            SELECT c.slug, MAX(a.updated_at) AS updated_at
            FROM tbl_categories c
            JOIN tbl_articles a ON a.category_id = c.id AND a.status = 'published'
            WHERE c.status = 'active'
            GROUP BY c.id, c.slug
        `);
        const articles = await db.queryAll(`
            SELECT a.slug, a.updated_at
            FROM tbl_articles a
            WHERE a.status = 'published'
            ORDER BY a.published_at DESC
            LIMIT 5000
        `);

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        xml += urlEntry(`${base}/`, toDate(articles[0] && articles[0].updated_at), 'daily', '1.0');

        categories.forEach((cat) => {
            xml += urlEntry(`${base}/category/${cat.slug}`, toDate(cat.updated_at), 'weekly', '0.6');
        });

        articles.forEach((art) => {
            xml += urlEntry(`${base}/${art.slug}`, toDate(art.updated_at), 'monthly', '0.8');
        });

        xml += '</urlset>';

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).send('Error generating sitemap');
    }
};
