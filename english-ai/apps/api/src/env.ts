const requiredInProduction = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "DATABASE_URL", "OPENAI_API_KEY"] as const;
const billingInProduction = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "BILLING_SUCCESS_URL",
  "BILLING_CANCEL_URL",
  "BILLING_PORTAL_RETURN_URL",
] as const;

export function validateEnvironment() {
  const production = process.env.NODE_ENV === "production";
  if (!production) return;

  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (process.env.AUTH_REQUIRED !== "true") {
    throw new Error("AUTH_REQUIRED must be true in production");
  }

  if (process.env.TRUST_PROXY === "true" && process.env.TRUST_PROXY_HOPS !== "1") {
    throw new Error("Set TRUST_PROXY_HOPS=1 when TRUST_PROXY=true");
  }

  const billingEnabled = process.env.BILLING_ENABLED === "true";
  if (billingEnabled) {
    const missingBilling = billingInProduction.filter((key) => !process.env[key]);
    if (missingBilling.length > 0) {
      throw new Error(`Missing required billing environment variables: ${missingBilling.join(", ")}`);
    }
  }
}
