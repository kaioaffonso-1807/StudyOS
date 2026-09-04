# StudyOS English AI — Production Checklist

This checklist is the final handoff between the codebase and the real production accounts. Code and CI can be validated automatically; account credentials, hosted services, store accounts, and legal identity must be configured by the owner.

## 1. Backend environment

Configure these variables on the API host; never commit secrets:

- `NODE_ENV=production`
- `PORT=4000` (or the port supplied by the hosting platform)
- `AUTH_REQUIRED=true`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`
- `DATABASE_SSL=true`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_TRANSCRIBE_MODEL`
- `OPENAI_TTS_MODEL`
- `OPENAI_TTS_VOICE`
- `OPENAI_REALTIME_MODEL`
- `OPENAI_REALTIME_VOICE`
- `TRUST_PROXY` and `TRUST_PROXY_HOPS` only when the hosting topology requires them

For billing:

- `BILLING_ENABLED=true`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `BILLING_SUCCESS_URL`
- `BILLING_CANCEL_URL`
- `BILLING_PORTAL_RETURN_URL`

Keep the usage-limit variables explicitly configured if production pricing/limits differ from the safe defaults in `.env.example`.

## 2. Database

Before accepting real users:

1. Create the production PostgreSQL/Supabase database.
2. Apply every SQL migration in `english-ai/apps/api/src/database/migrations/` in order.
3. Confirm RLS is enabled on application, billing, and usage tables.
4. Confirm direct `anon`/`authenticated` table access remains revoked where the API owns access.
5. Run a backup/restore test before launch.
6. Verify the API can reach the database through `/ready`.

Do not point production at a local database.

## 3. Supabase Auth and password recovery

The mobile app uses the custom scheme `studyos` and sends password-reset users to:

`studyos://auth/reset`

In the Supabase Auth URL Configuration, add the production mobile redirect URL (for example `studyos://**` or the narrower path allowed by the project configuration). The redirect must be allowed by Supabase before password recovery can work.

Also verify:

- email confirmation behavior
- password policy
- SMTP/email delivery
- production Site URL where applicable
- no development redirect URLs are accidentally used for production users

Reference: Supabase native mobile deep linking and redirect URL documentation.

## 4. Stripe

Create the production Pro monthly and yearly prices and place their IDs in the API environment.

Configure one production webhook endpoint at the deployed API host:

`POST /api/v1/billing/webhook`

Subscribe it to the billing events required by the application and copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

Verify with a real test subscription before launch:

1. Free user starts checkout.
2. Stripe Checkout completes.
3. Webhook reaches the API.
4. Entitlement changes to Pro.
5. Mobile returns from checkout and refreshes entitlement/usage.
6. Customer Portal opens for a Pro user.
7. Cancellation/status changes are reflected by the webhook.

Never put Stripe secret keys in the mobile app.

## 5. API deployment

Use the existing `english-ai/apps/api/Dockerfile` and deployment runbook.

Production smoke checks:

- `GET /health` returns liveness successfully.
- `GET /ready` returns success only when production dependencies are ready.
- authenticated API routes reject missing/invalid tokens.
- rate limits and daily usage limits work.
- request IDs are present on API responses/errors.
- Stripe webhook signature validation is active.
- TLS is terminated by the hosting platform/load balancer.
- logs contain no access tokens, passwords, Stripe secrets, or full payment details.

The current in-memory rate limiter is acceptable for an MVP with a single API instance. Before horizontal scaling, move rate limiting/usage coordination to shared infrastructure.

## 6. Mobile production configuration

Set EAS/Expo environment variables:

- `EXPO_PUBLIC_API_URL=https://<production-api-host>`
- `EXPO_PUBLIC_SUPABASE_URL=<production-supabase-url>`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production-publishable-key>`

Run EAS project configuration once the Expo account/project is available. This should populate the project-specific EAS identifiers; do not invent a project ID in source control.

The current EAS profiles are:

- `development` — development client/internal distribution
- `preview` — internal distribution
- `production` — production channel

## 7. Final mobile validation

Before store submission:

- install a production build on a physical Android device
- install a production build on a physical iPhone
- sign up
- confirm email
- sign in/out
- request password reset and complete the deep-link flow
- complete placement
- load personalized lesson
- send text conversation
- record and submit a voice turn
- verify progress updates
- open Billing
- verify free usage limits
- complete a Stripe test checkout
- return to the app and confirm Pro entitlement refresh
- open Customer Portal
- export user data
- delete user learning data
- verify the app remains usable after a network interruption

## 8. Store/legal requirements

Before public release, replace the legal placeholders with the real company/operator information:

- legal entity/name
- support email
- privacy contact / DPO or equivalent where applicable
- privacy policy URL
- terms URL
- data retention/deletion policy
- billing/refund policy
- app support URL

Complete the Apple App Store and Google Play privacy/data-safety declarations from the actual production data flows. The repository legal documents are templates and are not legal advice.

## 9. GitHub/CI gate

A release is ready only when:

- API CI is green: install, typecheck, unit tests, production build, Docker build.
- Mobile CI is green: install, typecheck, Expo Doctor.
- the production commit is tagged/released from `main`.
- no secrets are present in Git history or tracked `.env` files.

## 10. Launch gate

**Code status:** production-ready MVP baseline.

**Still requires owner/account actions:** production credentials, Supabase configuration, database migration execution, Stripe configuration, API hosting, EAS project/account setup, physical-device acceptance tests, store accounts/submission, and final legal identity/policies.
