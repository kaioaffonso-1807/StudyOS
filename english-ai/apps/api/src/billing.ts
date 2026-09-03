import Stripe from "stripe";
import { findUserByStripeCustomer, getBillingAccount, upsertBillingAccount } from "./database.js";

const client = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export function billingEnabled() {
  return Boolean(client && process.env.STRIPE_PRICE_ID);
}

export async function createCheckout(userId: string, email?: string) {
  if (!client || !process.env.STRIPE_PRICE_ID) throw new Error("Billing is not configured");
  const existing = await getBillingAccount(userId);
  const customer = existing?.stripeCustomerId
    ? await client.customers.retrieve(existing.stripeCustomerId)
    : await client.customers.create({ email, metadata: { studyosUserId: userId } });
  if (customer.deleted) throw new Error("Stripe customer is unavailable");
  await upsertBillingAccount(userId, { stripeCustomerId: customer.id, status: existing?.status ?? "inactive", plan: existing?.plan ?? "free", currentPeriodEnd: existing?.currentPeriodEnd ? new Date(existing.currentPeriodEnd) : null }, email);
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: process.env.STRIPE_SUCCESS_URL || "https://example.com/billing/success",
    cancel_url: process.env.STRIPE_CANCEL_URL || "https://example.com/billing/cancel",
    metadata: { studyosUserId: userId },
    subscription_data: { metadata: { studyosUserId: userId } },
  });
  return session.url;
}

export async function createPortal(userId: string) {
  if (!client) throw new Error("Billing is not configured");
  const account = await getBillingAccount(userId);
  if (!account?.stripeCustomerId) throw new Error("No Stripe customer found");
  const session = await client.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: process.env.STRIPE_PORTAL_RETURN_URL || process.env.STRIPE_SUCCESS_URL || "https://example.com/billing",
  });
  return session.url;
}

function subscriptionState(subscription: Stripe.Subscription) {
  const active = subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due";
  return { plan: active ? "premium" as const : "free" as const, status: subscription.status, currentPeriodEnd: new Date(subscription.items.data[0]?.current_period_end ? subscription.items.data[0].current_period_end * 1000 : Date.now()) };
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = String(subscription.metadata.studyosUserId || "") || await findUserByStripeCustomer(customerId);
  if (!userId) return;
  const state = subscriptionState(subscription);
  await upsertBillingAccount(userId, { stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, ...state });
}

export async function handleStripeEvent(event: Stripe.Event) {
  if (!client) throw new Error("Billing is not configured");
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await client.subscriptions.retrieve(String(session.subscription));
        await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (subscriptionId) await syncSubscription(await client.subscriptions.retrieve(subscriptionId));
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const userId = await findUserByStripeCustomer(customerId);
        if (userId) {
          const account = await getBillingAccount(userId);
          await upsertBillingAccount(userId, { stripeCustomerId: customerId, stripeSubscriptionId: account?.stripeSubscriptionId, plan: "free", status: "payment_failed", currentPeriodEnd: account?.currentPeriodEnd ? new Date(account.currentPeriodEnd) : null });
        }
      }
      break;
    }
    default:
      break;
  }
}

export function constructWebhookEvent(payload: Buffer, signature: string) {
  if (!client || !process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe webhook is not configured");
  return client.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
