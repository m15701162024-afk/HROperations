-- 招聘运营数据下钻体系数据库模型建议稿
-- 当前系统仍使用本地 JSON 存储；接入真实数据库时按本脚本迁移。

CREATE TABLE platform_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  positioning TEXT,
  owner_user_id TEXT,
  auth_status TEXT NOT NULL,
  status TEXT NOT NULL,
  attribution TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  family TEXT,
  city TEXT,
  level TEXT,
  type TEXT,
  status TEXT,
  beisen_job_code TEXT,
  beisen_url TEXT,
  website_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE contents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  job_id TEXT,
  platform TEXT NOT NULL,
  account_id TEXT,
  content_type TEXT,
  status TEXT,
  owner_user_id TEXT,
  reviewer_user_id TEXT,
  risk_level TEXT,
  published_at TEXT,
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE content_metrics (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  account_id TEXT,
  metric_date TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  source_id TEXT,
  sync_batch_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(content_id, metric_date, source_id)
);

CREATE TABLE attribution_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  platform TEXT,
  account_id TEXT,
  content_id TEXT,
  job_id TEXT,
  candidate_code TEXT NOT NULL,
  stage TEXT NOT NULL,
  event_time TEXT,
  source_id TEXT,
  sync_batch_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE metric_sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  platform TEXT,
  name TEXT NOT NULL,
  owner_user_id TEXT,
  imported_at TEXT NOT NULL,
  sync_batch_id TEXT,
  raw_file_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sync_batches (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_summary TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE metric_quality_issues (
  id TEXT PRIMARY KEY,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  message TEXT NOT NULL,
  source_id TEXT,
  sync_batch_id TEXT,
  resolved INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE cost_records (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  labor_cost REAL DEFAULT 0,
  media_cost REAL DEFAULT 0,
  production_cost REAL DEFAULT 0,
  cost_date TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(target_type, target_id, cost_date)
);

CREATE TABLE analytics_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  dimension TEXT NOT NULL,
  date_from TEXT,
  date_to TEXT,
  payload_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_content_metrics_content_date ON content_metrics(content_id, metric_date);
CREATE INDEX idx_content_metrics_platform_date ON content_metrics(platform, metric_date);
CREATE INDEX idx_contents_dims ON contents(platform, account_id, job_id, published_at);
CREATE INDEX idx_attribution_dims ON attribution_events(platform, content_id, job_id, candidate_code, stage);
CREATE INDEX idx_sync_batches_source ON sync_batches(source_id, started_at);
CREATE INDEX idx_quality_target ON metric_quality_issues(target_type, target_id, resolved);
CREATE INDEX idx_analytics_cache_query ON analytics_cache(query_hash, expires_at);
