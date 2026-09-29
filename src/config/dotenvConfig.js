require('dotenv').config();

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

module.exports = {
    port: process.env.PORT || 4000,
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT || 3306,
    dbUser: process.env.DB_USER || 'admin',
    dbPass: process.env.DB_PASS || '',
    dbName: process.env.DB_NAME || 'readyio_db',
    jwtSecret: process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    siteUrl: process.env.SITE_URL || 'https://readyio.com',
    blogSiteUrl: (process.env.BLOG_SITE_URL || 'https://blog.readyio.com').replace(/\/+$/, ''),
    redisUrl: process.env.UPSTASH_REDIS_REST_URL,
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    cacheKeyPrefix: process.env.CACHE_KEY_PREFIX || 'readyio',
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'readyio-blog',
    revalidateSecret: process.env.REVALIDATE_SECRET || '',
    revalidateWebhooks: (process.env.REVALIDATE_WEBHOOKS || '')
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean),
};
