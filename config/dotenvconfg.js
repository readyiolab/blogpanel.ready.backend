const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  dbHost: process.env.DB_HOST || "localhost",
  dbUser: process.env.DB_USER || "root",
  dbPass: process.env.DB_PASS || process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "readyio_db",
  jwtSecret: process.env.JWT_SECRET,
  smtpHost: process.env.EMAIL_HOST, // Changed from SMTP_HOST
  smtpPort: process.env.EMAIL_PORT, // Changed from SMTP_PORT
  smtpUser: process.env.EMAIL_USER, // Changed from SMTP_USER
  smtpPass: process.env.EMAIL_PASS, // Changed from SMTP_PASS
  
};
