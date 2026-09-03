CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  native_language TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE learning_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cefr_level TEXT NOT NULL DEFAULT 'A1',
  speaking_score NUMERIC(5,2) DEFAULT 0,
  listening_score NUMERIC(5,2) DEFAULT 0,
  grammar_score NUMERIC(5,2) DEFAULT 0,
  vocabulary_score NUMERIC(5,2) DEFAULT 0,
  pronunciation_score NUMERIC(5,2) DEFAULT 0,
  goal TEXT,
  daily_minutes INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE learner_memory (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal TEXT,
  interests TEXT[] NOT NULL DEFAULT '{}',
  preferred_topics TEXT[] NOT NULL DEFAULT '{}',
  learned_vocabulary TEXT[] NOT NULL DEFAULT '{}',
  conversation_count INT NOT NULL DEFAULT 0,
  total_turns INT NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lessons (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, skill TEXT NOT NULL, cefr_level TEXT NOT NULL, content JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE attempts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL, answer TEXT, is_correct BOOLEAN, feedback JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE mistakes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, category TEXT NOT NULL, source TEXT NOT NULL, original_text TEXT, corrected_text TEXT, count INT NOT NULL DEFAULT 1, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, topic TEXT NOT NULL, cefr_level TEXT, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ);
CREATE TABLE conversation_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('user','assistant','system')), content TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE learning_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, skill TEXT NOT NULL, performance NUMERIC(5,2), source TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE review_items (
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

CREATE TABLE billing_accounts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium')),
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempts_user ON attempts(user_id, created_at DESC);
CREATE INDEX idx_mistakes_user ON mistakes(user_id, resolved, last_seen_at DESC);
CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id, created_at);
CREATE INDEX idx_learning_events_user ON learning_events(user_id, created_at DESC);
CREATE INDEX idx_review_items_due ON review_items(user_id, due_at);
CREATE INDEX idx_billing_subscription ON billing_accounts(stripe_subscription_id);
