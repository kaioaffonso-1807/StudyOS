import Stripe from "stripe";
import type { User } from "@supabase/supabase-js";
import pg from "pg";

const { Pool } = pg;
const ssl = process.env.DATABASE_SSL === "false"
  ? false
  : process.env.DATABASE_SSL_CA
    ? { ca: process.env.DATABASE_SSL_CA, rejectUnauthorized: true }
    : { rejectUnauthorized: true };
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl })
  : null;

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const featureEnabled = process.env.BILLING_ENABLED === "true";

const prices: Record<string, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
};

const successUrl = process.env.BILLING_SUCCESS_URL;
const cancelUrl = process.env.BILLING_CANCEL_URL;
const portalReturnUrl = process.env.BILLING_PORTAL_RETURN_URL;

export type UsageAction = "ai_turn" | "voice_turn" | "realtime_call";
export type Plan = "free" | "pro";
export type UsageResult = { allowed: boolean; plan: Plan; action: UsageAction; used: number; limit: number };

function positiveInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function usageLimits(plan: Plan) {
  if (plan === "pro") {
    return {
      ai_turn: positiveInt("USAGE_PRO_AI_TURNS_DAILY", 100),
      voice_turn: positiveInt("USAGE_PRO_VOICE_TURNS_DAILY", 30),
      realtime_call: positiveInt("USAGE_PRO_REALTIME_CALLS_DAILY", 30),
    } satisfies Record<UsageAction, number>;
  }
  return {
    ai_turn: positiveInt("USAGE_FREE_AI_TURNS_DAILY", 10),
    voice_turn: positiveInt("USAGE_FREE_VOICE_TURNS_DAILY", 3),
    realtime_call: positiveInt("USAGE_FREE_REALTIME_CALLS_DAILY", 5),
  } satisfies Record<UsageAction, number>;
}

export function billingEnabled() {
  return featureEnabled && Boolean(pool && stripe && prices.monthly && prices.yearly && successUrl && cancelUrl && portalReturnUrl);
}

export function stripeConfigured() {
  return Boolean(stripe);
}

async function ensureUser(user: User) {
  if (!pool) throw new Error("database disabled");
  const email = user.email ?? `${user.id}@studyos.local`;
  const result = await pool.query(
    `INSERT INTO users (id, external_id, email, display_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, display_name=EXCLUDED.display_name, updated_at=now()
     RETURNING id`,
    [user.id, user.id, email, user.user_metadata?.display_name ?? null],
  );
  return String(result.rows[0].id);
}

async function customerForUser(user: User) {
  if (!pool || !stripe) throw new Error("billing is not configured");
  const userId = await ensureUser(user);
  const existing = await pool.query(`SELECT provider_customer_id FROM billing_customers WHERE user_id=$1`, [userId]);
  if (existing.rowCount) return String(existing.rows[0].provider_customer_id);
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.user_metadata?.display_name ?? undefined,
    metadata: { studyos_user_id: user.id },
  });
  await pool.query(
    `INSERT INTO billing_customers(user_id,provider,provider_customer_id) VALUES($1,'stripe',$2)
     ON CONFLICT(user_id) DO UPDATE SET provider_customer_id=EXCLUDED.provider_customer_id,updated_at=now()`,
    [userId, customer.id],
  );
  return customer.id;
}

export async function createCheckoutSession(user: User, cycle: "monthly" | "yearly", _clientSuccessUrl?: string, _clientCancelUrl?: string) {
  if (!stripe || !pool) throw new Error("billing is not configured");
  const price = prices[cycle];
  if (!price || !successUrl || !cancelUrl) throw new Error("Stripe billing URLs or price are not configured");
  const customer = await customerForUser(user);
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: { studyos_user_id: user.id, plan: "pro", cycle },
    subscription_data: { metadata: { studyos_user_id: user.id, plan: "pro" } },
  });
}

export async function createPortalSession(user: User, _clientReturnUrl?: string) {
  if (!stripe || !portalReturnUrl) throw new Error("billing portal is not configured");
  const customer = await customerForUser(user);
  return stripe.billingPortal.sessions.create({ customer, return_url: portalReturnUrl });
}

export async function getEntitlement(userId: string) {
  if (!pool) return { plan: "free", active: false, status: "disabled" };
  const result = await pool.query(
    `SELECT plan,status,current_period_end,cancel_at_period_end
       FROM billing_subscriptions
      WHERE user_id=$1 AND status IN ('active','trialing','past_due')
      ORDER BY updated_at DESC LIMIT 1`,
    [userId],
  );
  if (!result.rowCount) return { plan: "free", active: false, status: "free" };
  const row = result.rows[0];
  return {
    plan: String(row.plan),
    active: ["active", "trialing"].includes(String(row.status)),
    status: String(row.status),
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end).toISOString() : null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

export async function consumeUsage(userId: string, action: UsageAction): Promise<UsageResult> {
  const entitlement = await getEntitlement(userId);
  const plan: Plan = entitlement.active && entitlement.plan === "pro" ? "pro" : "free";
  const limit = usageLimits(plan)[action];
  if (!pool) return { allowed: true, plan, action, used: 0, limit };

  const result = await pool.query(
    `INSERT INTO usage_counters(user_id,usage_date,action,count)
     VALUES($1,CURRENT_DATE,$2,1)
     ON CONFLICT(user_id,usage_date,action) DO UPDATE
       SET count=usage_counters.count+1,updated_at=now()
       WHERE usage_counters.count < $3
     RETURNING count`,
    [userId, action, limit],
  );
  if (result.rowCount) {
    return { allowed: true, plan, action, used: Number(result.rows[0].count), limit };
  }
  const current = await pool.query(
    `SELECT count FROM usage_counters WHERE user_id=$1 AND usage_date=CURRENT_DATE AND action=$2`,
    [userId, action],
  );
  return { allowed: false, plan, action, used: Number(current.rows[0]?.count ?? limit), limit };
}

async function userIdByCustomer(customerId: string) {
  if (!pool) return null;
  const result = await pool.query(`SELECT user_id FROM billing_customers WHERE provider_customer_id=$1`, [customerId]);
  return result.rowCount ? String(result.rows[0].user_id) : null;
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  if (!stripe || !pool || !process.env.STRIPE_WEBHOOK_SECRET) throw new Error("billing webhook is not configured");
  const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  const inserted = await pool.query(
    `INSERT INTO billing_webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`,
    [event.id, event.type],
  );
  if (!inserted.rowCount) return { duplicate: true };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "subscription" && session.subscription && session.customer) {
      const userId = session.metadata?.studyos_user_id ?? session.client_reference_id;
      if (userId) {
        await pool.query(
          `INSERT INTO billing_customers(user_id,provider,provider_customer_id)
           VALUES($1,'stripe',$2)
           ON CONFLICT(user_id) DO UPDATE SET provider_customer_id=EXCLUDED.provider_customer_id,updated_at=now()`,
          [userId, String(session.customer)],
        );
      }
    }
  }

  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = String(subscription.customer);
    const userId = subscription.metadata?.studyos_user_id ?? await userIdByCustomer(customerId);
    if (userId) {
      const itemPrice = subscription.items.data[0]?.price?.id ?? null;
      const plan = subscription.metadata?.plan ?? "pro";
      const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
      await pool.query(
        `INSERT INTO billing_subscriptions(user_id,provider,provider_subscription_id,provider_customer_id,price_id,plan,status,current_period_end,cancel_at_period_end,updated_at)
         VALUES($1,'stripe',$2,$3,$4,$5,$6,to_timestamp($7),$8,now())
         ON CONFLICT(provider_subscription_id) DO UPDATE SET price_id=EXCLUDED.price_id,plan=EXCLUDED.plan,status=EXCLUDED.status,current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now()`,
        [userId, subscription.id, customerId, itemPrice, plan, subscription.status, periodEnd, subscription.cancel_at_period_end],
      );
    }
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (customerId) {
      const userId = await userIdByCustomer(customerId);
      if (userId && event.type === "invoice.payment_failed") {
        await pool.query(`UPDATE billing_subscriptions SET updated_at=now() WHERE user_id=$1`, [userId]);
      }
    }
  }

  return { duplicate: false, eventId: event.id, eventType: event.type };
}

export async function closeBilling() {
  if (pool) await pool.end();
}
