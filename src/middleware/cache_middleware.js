const redis = require('../config/redis');
const { cacheKeyPrefix } = require('../config/dotenvConfig');

const CACHE_VERSION_KEY = `${cacheKeyPrefix}:cache:ver`;

const getCacheVersion = async () => {
    if (!redis) {
        return '0';
    }

    const version = await redis.get(CACHE_VERSION_KEY);
    if (!version) {
        await redis.set(CACHE_VERSION_KEY, '1');
        return '1';
    }

    return String(version);
};

/**
 * Middleware to cache GET requests
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 */
const cacheMiddleware = (ttl = 3600) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET' || !redis) {
            return next();
        }

        try {
            const version = await getCacheVersion();
            const key = `${cacheKeyPrefix}:cache:v${version}:${req.originalUrl || req.url}`;
            const cachedData = await redis.get(key);

            if (cachedData) {
                // Return cached data
                return res.json(cachedData);
            }

            // Override res.json to cache the result
            const originalJson = res.json;
            res.json = (data) => {
                // Restore original res.json
                res.json = originalJson;

                // Cache the data before sending
                // We only cache successful responses
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redis.set(key, data, { ex: ttl }).catch(err => {
                        console.error('Redis cache set error:', err);
                    });
                }

                return res.json(data);
            };

            next();
        } catch (error) {
            console.error('Redis cache middleware error:', error);
            // On redis error, just proceed without caching
            next();
        }
    };
};

/**
 * Invalidate every cached response by bumping the cache version.
 */
const clearCache = async () => {
    if (!redis) return;

    try {
        await redis.incr(CACHE_VERSION_KEY);
    } catch (error) {
        console.error('Redis clearCache error:', error);
    }
};

module.exports = {
    cacheMiddleware,
    clearCache
};
