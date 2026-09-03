-- StudyOS billing baseline: Stripe subscriptions + webhook idempotency.
-- Payment provider remains the source of truth; this database stores a local entitlement projection.

CREATE TABLE IF NOT EXISTS billing_customers (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_subscription_id TEXT NOT NULL UNIQUE,
  provider_customer_id TEXT NOT NULL,
  price_id TEXT,
  plan TEXT NOT NULL DEFAULT 'pro',
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_user_idx ON billing_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_status_idx ON billing_subscriptions(status);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_customers, public.billing_subscriptions, public.billing_webhook_events FROM anon, authenticated;
