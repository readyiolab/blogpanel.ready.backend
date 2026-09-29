-- ============================================================
-- Readyio contact server tables (readyio.com)
-- Superseded by sql/readyio_schema.sql, which contains these tables
-- plus the blog CMS tables. Run `npm run migrate` instead.
-- ============================================================

CREATE DATABASE IF NOT EXISTS readyio_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE readyio_db;

-- 1. Contact Form Messages Table
CREATE TABLE IF NOT EXISTS tbl_contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  country VARCHAR(100) DEFAULT NULL,
  service VARCHAR(255) DEFAULT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS tbl_newsletter_subscribers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  subscription_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_subscribed TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Full Booking Requests Table
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

-- 4. Chatbot Quick Bookings Table
CREATE TABLE IF NOT EXISTS tbl_chatbot_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
