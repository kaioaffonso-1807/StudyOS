# StudyOS Billing setup

StudyOS uses Stripe Billing for the Pro subscription. Checkout and the Customer Portal are created server-side; the client never receives `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`.

## Required production variables

```text
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
BILLING_SUCCESS_URL=https://YOUR_APP_DOMAIN/billing/success
BILLING_CANCEL_URL=https://YOUR_APP_DOMAIN/billing/cancel
BILLING_PORTAL_RETURN_URL=https://YOUR_APP_DOMAIN/settings/billing
```

Both monthly and yearly prices are required when billing is enabled. The backend never accepts a client-supplied Stripe price ID; it maps `monthly`/`yearly` to these server-side environment variables.

## Stripe Dashboard

1. Create the Pro recurring products/prices in Stripe Test mode first.
2. Configure the webhook endpoint as `POST /api/v1/billing/webhook`.
3. Subscribe at minimum to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`.
4. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Test Checkout, renewal, cancellation, and a failed payment before switching to live mode.

Stripe requires the webhook's raw request body for signature verification. The API therefore registers the webhook before `express.json()` and uses `express.raw()` for that endpoint.

## Entitlements

The database stores a local projection of Stripe subscription state. Product access should use `/api/v1/billing/entitlement`; never trust a plan value sent by the client.

`active` is true for `active` and `trialing`. `past_due` is visible in the entitlement response but is not considered active access.

## Important production rule

The migrations in `database/migrations/002_billing.sql` and `database/migrations/002_usage_counters.sql` must be applied to the production PostgreSQL database before enabling paid usage. Keep Stripe secrets only in the deployment provider's secret manager/environment configuration, never in Git or the mobile app.
