CREATE TABLE friend_link_applications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  github_id TEXT NOT NULL,
  github_name TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  avatar TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  mail_status TEXT NOT NULL DEFAULT 'pending' CHECK (mail_status IN ('pending', 'sending', 'sent', 'failed')),
  mail_attempt_at INTEGER
);
CREATE INDEX friend_link_applications_user_idx ON friend_link_applications (user_id, created_at);
