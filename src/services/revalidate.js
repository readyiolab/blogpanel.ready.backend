const { revalidateSecret, revalidateWebhooks } = require('../config/dotenvConfig');

/**
 * Notify the Next.js sites (readyio.com and blog.readyio.com) that article
 * content changed so they can refresh their cached pages.
 * Fire-and-forget: failures are logged and never affect the caller.
 */
const notifyArticleChange = ({ slug = null, oldSlug = null } = {}) => {
    if (!revalidateWebhooks.length || !revalidateSecret) {
        return;
    }

    const body = JSON.stringify({ slug, oldSlug });

    revalidateWebhooks.forEach((url) => {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-revalidate-secret': revalidateSecret,
            },
            body,
            signal: AbortSignal.timeout(5000),
        })
            .then((res) => {
                if (!res.ok) {
                    console.warn(`Revalidation webhook ${url} responded with ${res.status}`);
                }
            })
            .catch((error) => {
                console.warn(`Revalidation webhook ${url} failed:`, error.message);
            });
    });
};

module.exports = { notifyArticleChange };
