CREATE TABLE IF NOT EXISTS review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  answer TEXT,
  correction TEXT,
  category TEXT NOT NULL,
  repetitions INT NOT NULL DEFAULT 0,
  ease NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  interval_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_items_due ON review_items(user_id, due_at);
