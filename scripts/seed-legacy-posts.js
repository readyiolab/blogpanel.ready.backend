#!/usr/bin/env node
/**
 * Seeds the six posts that were hard-coded in the old Readyio Frontend
 * (src/content/posts.ts) into the CMS database, with their three authors.
 *
 * Images are read from the old Frontend assets folder (read only) and uploaded
 * to Cloudinary; if that folder is gone, the copies already on Cloudinary are
 * reused. Posts whose slug already exists are skipped, so the script is safe
 * to run more than once.
 *
 *   npm run seed:legacy-posts
 *
 * Optional env: LEGACY_ASSETS_DIR (defaults to ../Frontend/src/assets).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { v2: cloudinary } = require('cloudinary');

const data = require('./data/legacy-posts.json');

const dbName = process.env.DB_NAME;
const cloudinaryFolder = process.env.CLOUDINARY_FOLDER || 'readyio-blog';
const assetsDir = path.resolve(
  process.env.LEGACY_ASSETS_DIR || path.join(__dirname, '..', '..', 'Frontend', 'src', 'assets')
);

if (!dbName) {
  console.error('DB_NAME is not set. Please configure backend/.env first.');
  process.exit(1);
}

if (!process.env.CLOUDINARY_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('CLOUDINARY_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set to upload the post images.');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function buildConnectionConfig() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 3,
  };

  if (config.host && config.host.includes('rds.amazonaws.com')) {
    const sslPath = path.resolve(__dirname, '..', 'global-bundle.pem');
    if (fs.existsSync(sslPath)) {
      config.ssl = { rejectUnauthorized: false, ca: fs.readFileSync(sslPath) };
    }
  }

  return config;
}

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slugify = (text) => text
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_-]+/g, '-')
  .replace(/^-+|-+$/g, '');

function bodyToHtml(blocks) {
  return blocks.map((block) => {
    switch (block.type) {
      case 'h2':
        return `<h2>${escapeHtml(block.text)}</h2>`;
      case 'h3':
        return `<h3>${escapeHtml(block.text)}</h3>`;
      case 'quote':
        return `<blockquote><p>${escapeHtml(block.text)}</p></blockquote>`;
      case 'list':
        return `<ul>${block.text.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      default:
        return `<p>${escapeHtml(block.text)}</p>`;
    }
  }).join('\n');
}

const uploadCache = new Map();

async function uploadAsset(fileName) {
  if (uploadCache.has(fileName)) return uploadCache.get(fileName);

  const filePath = path.join(assetsDir, fileName);
  const publicId = `legacy-${path.parse(fileName).name}`;

  // Without the old Frontend assets, reuse the copy uploaded by an earlier run.
  if (!fs.existsSync(filePath)) {
    try {
      const existing = await cloudinary.api.resource(`${cloudinaryFolder}/${publicId}`);
      console.log(`  image ${fileName} -> ${existing.secure_url} (already on Cloudinary)`);
      uploadCache.set(fileName, existing.secure_url);
      return existing.secure_url;
    } catch {
      throw new Error(`Legacy asset not found locally (${filePath}) or on Cloudinary (${cloudinaryFolder}/${publicId})`);
    }
  }

  const result = await cloudinary.uploader.upload(filePath, {
    folder: cloudinaryFolder,
    public_id: publicId,
    overwrite: false,
    resource_type: 'image',
  });
  console.log(`  image ${fileName} -> ${result.secure_url}${result.existing ? ' (already uploaded)' : ''}`);
  uploadCache.set(fileName, result.secure_url);
  return result.secure_url;
}

async function getRoleId(pool, roleName) {
  const [rows] = await pool.query('SELECT id FROM tbl_roles WHERE role_name = ? LIMIT 1', [roleName]);
  if (!rows[0]) throw new Error(`Role "${roleName}" not found. Run "npm run migrate" first.`);
  return rows[0].id;
}

async function ensureAuthor(pool, author, roleId) {
  const [existing] = await pool.query('SELECT id FROM tbl_users WHERE email = ? LIMIT 1', [author.email]);
  const avatarUrl = await uploadAsset(author.avatar);

  if (existing[0]) {
    await pool.query(
      `UPDATE tbl_users SET first_name = ?, last_name = ?, author_title = ?,
         profile_image = COALESCE(profile_image, ?)
       WHERE id = ?`,
      [author.firstName, author.lastName, author.title, avatarUrl, existing[0].id]
    );
    return existing[0].id;
  }

  // Authors log in only after an admin resets their password, so the initial one is random.
  const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const [result] = await pool.query(
    `INSERT INTO tbl_users
       (username, email, password, first_name, last_name, author_title, profile_image, role_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [author.username, author.email, password, author.firstName, author.lastName, author.title, avatarUrl, roleId]
  );
  console.log(`  created author ${author.firstName} ${author.lastName} <${author.email}>`);
  return result.insertId;
}

async function setTags(conn, articleId, tagNames) {
  for (const name of tagNames) {
    const slug = slugify(name);
    if (!slug) continue;
    await conn.query(
      `INSERT INTO tbl_tags (tag_name, slug, status) VALUES (?, ?, 'active')
       ON DUPLICATE KEY UPDATE tag_name = tag_name`,
      [name, slug]
    );
    const [rows] = await conn.query('SELECT id FROM tbl_tags WHERE slug = ? LIMIT 1', [slug]);
    if (rows[0]) {
      await conn.query('INSERT IGNORE INTO tbl_article_tags (article_id, tag_id) VALUES (?, ?)', [articleId, rows[0].id]);
    }
  }
}

async function main() {
  console.log(`Reading legacy assets from ${assetsDir}`);
  const pool = mysql.createPool(buildConnectionConfig());

  try {
    const authorRoleId = await getRoleId(pool, 'Author');

    const [categories] = await pool.query('SELECT id, slug FROM tbl_categories');
    const categoryIds = new Map(categories.map((row) => [row.slug, row.id]));

    console.log('Authors:');
    const authorIds = {};
    for (const [key, author] of Object.entries(data.authors)) {
      authorIds[key] = await ensureAuthor(pool, author, authorRoleId);
    }

    console.log('Posts:');
    let inserted = 0;
    let skipped = 0;

    for (const post of data.posts) {
      const [existing] = await pool.query(
        `SELECT id FROM tbl_articles WHERE slug = ?
         UNION SELECT article_id FROM tbl_article_slug_history WHERE old_slug = ?
         LIMIT 1`,
        [post.slug, post.slug]
      );
      if (existing[0]) {
        console.log(`  skip ${post.slug} (already exists)`);
        skipped += 1;
        continue;
      }

      const categoryId = categoryIds.get(post.category);
      if (!categoryId) throw new Error(`Category "${post.category}" not found. Run "npm run migrate" first.`);

      const coverUrl = await uploadAsset(post.cover);
      const publishedAt = `${post.publishedAt} 09:00:00`;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [result] = await conn.query(
          `INSERT INTO tbl_articles
             (title, slug, excerpt, content, featured_image, featured_image_alt, category_id, author_id,
              status, meta_title, meta_description, reading_time, is_featured, schema_type,
              published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, 'BlogPosting', ?, ?, ?)`,
          [
            post.title,
            post.slug,
            post.excerpt,
            bodyToHtml(post.body),
            coverUrl,
            post.title,
            categoryId,
            authorIds[post.author],
            post.title.slice(0, 160),
            post.excerpt.slice(0, 160),
            post.readingTime,
            post.featured ? 1 : 0,
            publishedAt,
            publishedAt,
            publishedAt,
          ]
        );
        await setTags(conn, result.insertId, post.tags);
        await conn.commit();
        console.log(`  inserted ${post.slug}`);
        inserted += 1;
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }

    console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seeding legacy posts failed:', error.message || error);
  process.exit(1);
});
