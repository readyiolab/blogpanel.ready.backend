// Both Backend servers share one database (readyio_db). The consolidated
// schema lives in sql/readyio_schema.sql and is applied by this script.
require('./scripts/migrate-and-seed-admin.js');
