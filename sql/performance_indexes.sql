ALTER TABLE tbl_articles
  ADD INDEX idx_articles_status_published_at (status, published_at),
  ADD INDEX idx_articles_category_status_published_at (category_id, status, published_at),
  ADD INDEX idx_articles_author_created_at (author_id, created_at);

ALTER TABLE tbl_comments
  ADD INDEX idx_comments_article_status_created_at (article_id, status, created_at);
