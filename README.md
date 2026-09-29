# Readyio API (`api.readyio.com`)

One Express server that powers:

- the **blog CMS** used by the admin panel (`blogpanel.readyio.com`) and read by `readyio.com` and `blog.readyio.com`;
- the **website forms** on readyio.com and the blog: contact, booking, AI chatbot and newsletter.

Production deployment: see [`../deploy/DEPLOYMENT.md`](../deploy/DEPLOYMENT.md).

## Local development

```bash
cp .env.example .env      # then fill in the values
npm install
npm run migrate           # create tables + admin user (safe to re-run)
npm run dev               # http://localhost:4000  (nodemon)
```

Health check: `curl http://localhost:4000/health`

| Script | What it does |
| --- | --- |
| `npm start` | Start the API (`node src/app.js`), used by PM2 in production |
| `npm run dev` | Start with auto-reload |
| `npm run migrate` | Apply `sql/readyio_schema.sql`, roles, permissions; create/update the admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (**resets that password**) |
| `npm run seed:legacy-posts` | Import the 6 original blog posts, uploading their images from `../Frontend/src/assets` to Cloudinary |

## Configuration

All settings come from `.env`; every key is documented in [`.env.example`](.env.example). The API will not start without `JWT_SECRET`.

- **Database:** MySQL via `mysql2`. When `DB_HOST` is an Amazon RDS host and `global-bundle.pem` exists in this folder, connections use SSL.
- **CORS:** `readyio.com`, `www.readyio.com`, `blog.readyio.com`, `blogpanel.readyio.com` and the local dev ports (8080, 8081, 5173, 5174) are always allowed. Add more with `CORS_ORIGIN` (comma-separated).
- **Revalidation:** after an article is created, updated, published or deleted, the API POSTs `{ slug, oldSlug }` with header `x-revalidate-secret: $REVALIDATE_SECRET` to every URL in `REVALIDATE_WEBHOOKS`, so the Next.js sites refresh immediately.
- **Cache:** Upstash Redis (optional). Without it, responses are served straight from MySQL.

## Endpoints

All paths are relative to `https://api.readyio.com`.

### Website (public)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/contact` | `{ name, email, message, country?, service? }` |
| POST | `/api/book` | Booking request form |
| POST | `/api/chat` | AI chatbot message (OpenRouter, falls back to rule-based replies) |
| POST | `/api/chat/book` | Chatbot booking; sends confirmation + lead emails via SMTP |
| POST | `/api/newsletter/subscribe` | `{ email }`; re-subscribes previously unsubscribed emails |
| POST | `/api/newsletter/unsubscribe` | `{ email }` |

Rate limits: contact, booking, newsletter and chat booking allow 10 requests per 15 minutes per IP; chat messages allow 40 per 5 minutes.

### Blog content (public)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/articles` | Published articles (paginated) |
| GET | `/api/articles/slugs` | All published slugs (used for static generation) |
| GET | `/api/articles/slug/:slug` | One article (returns redirect info for renamed slugs) |
| POST | `/api/articles/slug/:slug/view` | Count a view (rate limited) |
| GET | `/api/articles/category/:slug` | Articles in a category |
| GET | `/api/articles/search` | Full-text search |
| GET | `/api/articles/trending`, `/api/articles/featured` | Lists |
| GET | `/api/categories`, `/api/categories/:slug` | Categories |
| GET | `/sitemap.xml`, `/robots.txt` | API-level sitemap/robots |
| GET | `/health` | Liveness check |

### Admin (JWT required; used by the admin panel)

| Prefix | Purpose |
| --- | --- |
| `/api/auth` | login, logout, profile, change-password, forgot/reset password |
| `/api/articles` (POST/PUT/DELETE, `/my-articles`) | Create, edit, submit, approve, publish, delete articles |
| `/api/categories` (POST/PUT/DELETE) | Manage categories |
| `/api/comments` | Moderate comments |
| `/api/users` | Users and roles (RBAC) |
| `/api/upload` | Image uploads to Cloudinary |
| `/api/admin` | Dashboard, analytics, activity logs, newsletter subscribers |

## Project layout

```
Backend/
├── src/                 CMS: app.js (server entry), routes, controllers, models, middleware, services
├── routes/, controller/ Website forms: contact, booking, chatbot, newsletter
├── config/db.js         Connection pool used by the website form controllers
├── sql/                 Schema applied by `npm run migrate`
├── scripts/             Migration and legacy post seeder
├── global-bundle.pem    Amazon RDS CA bundle
└── docs/legacy/         Old generated docs, outdated (kept for reference only)
```
