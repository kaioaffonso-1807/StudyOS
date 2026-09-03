import Stripe from "stripe";

const client = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export function billingEnabled() {
  return Boolean(client && process.env.STRIPE_PRICE_ID);
}

export async function createCheckout(userId: string, email?: string) {
  if (!client || !process.env.STRIPE_PRICE_ID) throw new Error("Billing is not configured");
  const customer = await client.customers.create({ email, metadata: { studyosUserId: userId } });
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: process.env.STRIPE_SUCCESS_URL || "https://example.com/billing/success",
    cancel_url: process.env.STRIPE_CANCEL_URL || "https://example.com/billing/cancel",
    metadata: { studyosUserId: userId },
    subscription_data: { metadata: { studyosUserId: userId } }
  });
  return session.url;
}
