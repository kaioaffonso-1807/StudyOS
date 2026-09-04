CREATE TABLE IF NOT EXISTS usage_counters (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  action text NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date, action)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_user_date
  ON usage_counters(user_id, usage_date);

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE usage_counters FROM anon, authenticated;
