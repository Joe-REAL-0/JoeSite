CREATE TABLE comment_likes (
  post_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, comment_id, user_id)
);
CREATE INDEX comment_likes_user_idx ON comment_likes (user_id);
