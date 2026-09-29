require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// Import routes
const articleRoutes = require('./routes/article_routes');
const authRoutes = require('./routes/auth_routes');
const categoryRoutes = require('./routes/category_routes');
const userRoutes = require('./routes/user_routes');
const adminRoutes = require('./routes/admin_routes');
const commentRoutes = require('./routes/comment_routes');
const sitemapRoutes = require('./routes/sitemap_routes');

// Website routes: contact form, booking, chatbot and newsletter
const contactRoutes = require('../routes/contactRoutes');
const bookRoutes = require('../routes/bookRoutes');
const chatRoutes = require('../routes/chatRoutes');
const newsletterRoutes = require('../routes/newsletterRoutes');
const { formLimiter, chatLimiter } = require('./middleware/form_rate_limit');

// Import database
const db = require('./config/database');

const app = express();

// ==================== MIDDLEWARE ====================

// Bind each request to an AsyncLocalStorage context so DB transactions
// survive across await boundaries within the same request.
app.use((req, res, next) => {
  db.runWithContext(() => next());
});

// Trust proxy - for IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const defaultAllowedOrigins = [
  'https://readyio.com',
  'https://www.readyio.com',
  'https://blog.readyio.com',
  'https://blogpanel.readyio.com',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
  'http://localhost:5174',
];
const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Compression middleware
app.use(compression());

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files
const staticOptions = {
  maxAge: '30d', // 30 days
  immutable: true,
  setHeaders: (res, path) => {
    if (express.static.mime.lookup(path) === 'text/html') {
      res.setHeader('Cache-Control', 'public, max-age=0');
    }
  }
};

app.use('/uploads', express.static('uploads', staticOptions));
app.use('/public', express.static('public', staticOptions));

// ==================== CACHING MIDDLEWARE ====================

// Cache only public GET requests to avoid intermediaries storing private data.
const publicCache = (req, res, next) => {
  const isPublicGet = req.method === 'GET' && !req.headers.authorization;
  const isPublicArticleRoute = /^\/(slug\/|category\/|search$|trending$|featured$|slugs$|$)/.test(req.path);
  const isPublicCategoryRoute = req.baseUrl === '/api/categories';

  if (isPublicGet && (isPublicArticleRoute || isPublicCategoryRoute)) {
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  }
  next();
};

app.use('/api/articles', publicCache);
app.use('/api/categories', publicCache);

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// API version
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Readyio CMS API',
    version: '1.0.0',
    status: 'active'
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Article routes
app.use('/api/articles', articleRoutes);

// Category routes
app.use('/api/categories', categoryRoutes);

// User routes (profile, settings)
app.use('/api/users', userRoutes);

// Comment routes
app.use('/api/comments', commentRoutes);

// Website forms (readyio.com and blog.readyio.com)
app.use(['/api/contact', '/api/book', '/api/newsletter', '/api/chat/book'], formLimiter);
app.use('/api/chat', chatLimiter);
app.use('/api', contactRoutes);
app.use('/api', bookRoutes);
app.use('/api', chatRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Upload routes (Cloudinary imaging)
const uploadRoutes = require('./routes/upload_routes');
app.use('/api/upload', uploadRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Sitemap route
app.use('/', sitemapRoutes);


// Robots.txt
app.get('/robots.txt', (req, res) => {
  const robots = `User-agent: *
Allow: /
Allow: /api/articles
Disallow: /api/admin
Disallow: /api/auth
Sitemap: ${process.env.BLOG_SITE_URL || 'https://blog.readyio.com'}/sitemap.xml`;

  res.type('text/plain').send(robots);
});

// ==================== ERROR HANDLING ====================

// 404 - Not Found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: err.message
    });
  }

  // Database errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry - resource already exists'
    });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large - maximum limit is 5MB'
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }

  // Generic error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
    error: process.env.NODE_ENV === 'development' ? err : undefined,
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVER STARTUP ====================

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log(`
Readyio CMS API
  Environment: ${NODE_ENV}
  Port:        ${PORT}
  Database:    ${process.env.DB_NAME || 'readyio_db'}
  Site:        ${process.env.SITE_URL || 'https://readyio.com'}
  Blog:        ${process.env.BLOG_SITE_URL || 'https://blog.readyio.com'}
  Health:      http://localhost:${PORT}/health
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;
