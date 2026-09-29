-- ============================================================
-- Readyio consolidated database schema (readyio_db)
-- Used by both Backend servers:
--   * index.js      -> contact / newsletter / chat / booking
--   * src/app.js    -> blog CMS API (articles, users, RBAC, comments)
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- ---------- RBAC ----------
CREATE TABLE IF NOT EXISTS tbl_roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(15),
  profile_image VARCHAR(500),
  bio TEXT,
  author_title VARCHAR(120),
  twitter_url VARCHAR(255),
  facebook_url VARCHAR(255),
  linkedin_url VARCHAR(255),
  website_url VARCHAR(255),
  role_id INT NOT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES tbl_roles(id),
  INDEX (email),
  INDEX (username),
  INDEX (role_id),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  permission_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  module VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_role_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES tbl_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES tbl_permissions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_role_permission (role_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Blog taxonomy ----------
CREATE TABLE IF NOT EXISTS tbl_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (slug),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_sub_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  subcategory_name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  display_order INT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES tbl_categories(id) ON DELETE CASCADE,
  INDEX (category_id),
  INDEX (slug),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Articles ----------
CREATE TABLE IF NOT EXISTS tbl_articles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(250) UNIQUE NOT NULL,
  excerpt VARCHAR(500),
  content LONGTEXT NOT NULL,
  featured_image VARCHAR(500),
  featured_image_alt VARCHAR(255),
  category_id INT NOT NULL,
  sub_category_id INT,
  author_id INT NOT NULL,
  editor_id INT,
  status ENUM('draft', 'pending', 'published', 'archived') DEFAULT 'draft',

  meta_title VARCHAR(160),
  meta_description VARCHAR(160),
  meta_keywords VARCHAR(255),
  canonical_url VARCHAR(255),
  faq_json JSON NULL,
  schema_type VARCHAR(50) NOT NULL DEFAULT 'BlogPosting',

  views_count INT DEFAULT 0,
  reading_time INT,
  is_featured BOOLEAN DEFAULT FALSE,
  is_trending BOOLEAN DEFAULT FALSE,
  is_breaking BOOLEAN DEFAULT FALSE,
  allow_comments BOOLEAN DEFAULT TRUE,

  published_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id) REFERENCES tbl_categories(id),
  FOREIGN KEY (sub_category_id) REFERENCES tbl_sub_categories(id),
  FOREIGN KEY (author_id) REFERENCES tbl_users(id),
  FOREIGN KEY (editor_id) REFERENCES tbl_users(id),

  INDEX (slug),
  INDEX (author_id),
  INDEX (category_id),
  INDEX (status),
  INDEX (published_at),
  INDEX (is_featured),
  INDEX (is_trending),
  INDEX (is_breaking),
  INDEX idx_status_published (status, published_at),
  FULLTEXT INDEX ft_search (title, excerpt, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Old slugs of articles whose URL changed; used for permanent redirects.
CREATE TABLE IF NOT EXISTS tbl_article_slug_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT NOT NULL,
  old_slug VARCHAR(250) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  UNIQUE KEY unique_old_slug (old_slug),
  INDEX (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tag_name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (slug),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_article_tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT NOT NULL,
  tag_id INT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tbl_tags(id) ON DELETE CASCADE,
  UNIQUE KEY unique_article_tag (article_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT NOT NULL,
  user_id INT NOT NULL,
  comment_text TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  is_featured BOOLEAN DEFAULT FALSE,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES tbl_users(id),
  INDEX (article_id),
  INDEX (user_id),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_gallery (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT,
  image_url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255),
  caption TEXT,
  display_order INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  INDEX (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_videos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT,
  video_url VARCHAR(255) NOT NULL,
  video_type ENUM('youtube', 'vimeo', 'custom') DEFAULT 'youtube',
  thumbnail_url VARCHAR(255),
  duration INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  INDEX (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_related_articles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT NOT NULL,
  related_article_id INT NOT NULL,
  relevance_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (related_article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  UNIQUE KEY unique_related (article_id, related_article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_sitemap_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT,
  last_modified DATETIME,
  change_frequency VARCHAR(20),
  priority DECIMAL(3,2),
  FOREIGN KEY (article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  INDEX (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES tbl_users(id),
  INDEX (user_id),
  INDEX (created_at),
  INDEX (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_banners (
  id INT PRIMARY KEY AUTO_INCREMENT,
  banner_name VARCHAR(100) NOT NULL,
  banner_image VARCHAR(255),
  banner_url VARCHAR(255),
  position VARCHAR(50),
  status ENUM('active', 'inactive') DEFAULT 'active',
  start_date DATETIME,
  end_date DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (status),
  INDEX (start_date),
  INDEX (end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_article_analytics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  article_id INT NOT NULL,
  views INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  shares INT DEFAULT 0,
  date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES tbl_articles(id) ON DELETE CASCADE,
  INDEX (article_id),
  INDEX (date),
  UNIQUE KEY unique_article_date (article_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Newsletter (shared by the contact server and the CMS admin) ----------
CREATE TABLE IF NOT EXISTS tbl_newsletter_subscribers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  status ENUM('active', 'inactive', 'unsubscribed') DEFAULT 'active',
  is_subscribed TINYINT(1) DEFAULT 1,
  subscription_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  verification_token VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (email),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Contact server tables ----------
CREATE TABLE IF NOT EXISTS tbl_contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  country VARCHAR(100) DEFAULT NULL,
  service VARCHAR(255) DEFAULT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_booking_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  company VARCHAR(255) NOT NULL,
  job_title VARCHAR(100) DEFAULT NULL,
  service_interest VARCHAR(255) NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time VARCHAR(100) NOT NULL,
  how_did_you_hear VARCHAR(100) DEFAULT NULL,
  message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_chatbot_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Seed data ----------
INSERT IGNORE INTO tbl_roles (id, role_name, description) VALUES
(1, 'Admin', 'Full system access and administration'),
(2, 'Editor', 'Can edit and publish articles'),
(3, 'Reporter', 'Can create and submit articles for review'),
(4, 'Author', 'Can create and publish their own articles'),
(5, 'User', 'Regular website user');

INSERT IGNORE INTO tbl_permissions (id, permission_name, description, module) VALUES
(1, 'create_article', 'Create new article', 'article'),
(2, 'edit_article', 'Edit article', 'article'),
(3, 'delete_article', 'Delete article', 'article'),
(4, 'publish_article', 'Publish article', 'article'),
(5, 'view_all_articles', 'View all articles', 'article'),
(6, 'manage_categories', 'Manage categories', 'category'),
(7, 'manage_users', 'Manage users', 'user'),
(8, 'manage_roles', 'Manage roles and permissions', 'role'),
(9, 'view_analytics', 'View analytics', 'analytics'),
(10, 'manage_comments', 'Moderate comments', 'comment'),
(11, 'manage_banners', 'Manage banners', 'banner'),
(12, 'view_activity_logs', 'View activity logs', 'audit');

INSERT IGNORE INTO tbl_role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12),
(2, 1), (2, 2), (2, 4), (2, 5), (2, 10),
(3, 1), (3, 5),
(4, 1), (4, 2), (4, 4), (4, 5),
(5, 5);

INSERT IGNORE INTO tbl_categories (category_name, slug, description, display_order, status) VALUES
('Product', 'product', 'Product strategy, MVPs and shipping software that customers use.', 1, 'active'),
('Engineering', 'engineering', 'Architecture, web apps, CRMs and the engineering behind them.', 2, 'active'),
('AI', 'ai', 'Practical AI agents, automation and LLM workflows for businesses.', 3, 'active'),
('Design', 'design', 'UX, UI and conversion-focused website design.', 4, 'active'),
('Business', 'business', 'Operations, growth and technology decisions for founders.', 5, 'active');
