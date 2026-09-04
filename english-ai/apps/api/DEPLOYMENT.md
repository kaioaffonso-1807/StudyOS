# StudyOS English API — production deployment

## Runtime

The API is container-ready and exposes port `4000`.

- Build: `docker build -t studyos-english-api .`
- Run: `docker run --env-file .env.production -p 4000:4000 studyos-english-api`
- Liveness: `GET /health`
- Readiness: `GET /ready`

Use a managed HTTPS reverse proxy/load balancer in front of the container. Set `TRUST_PROXY=true` only when exactly one trusted proxy terminates the public connection; keep `TRUST_PROXY_HOPS=1`.

## Environment

Start from `.env.example` and provide production secrets through the hosting provider's secret manager. Never commit `.env.production`.

Required production values include:

- `NODE_ENV=production`
- `AUTH_REQUIRED=true`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`

When billing is enabled, also provide all Stripe variables documented in `BILLING_SETUP.md`.

## Database migrations

Apply migrations in order to the production PostgreSQL database:

1. Your existing/base StudyOS schema migration
2. `001_security_rls.sql`
3. `002_billing.sql`
4. `002_usage_counters.sql`

Verify that application tables and billing/usage tables exist before enabling paid traffic.

## Stripe

Expose `POST /api/v1/billing/webhook` through the same HTTPS API domain and configure its signing secret. Do not proxy the webhook through middleware that parses/reformats the request body before the StudyOS route.

## Privacy / LGPD

The authenticated API provides:

- `GET /api/v1/users/me/export` — exports application learning data as JSON.
- `DELETE /api/v1/users/me/data` — permanently removes application data, usage records and the local billing projection.

The deletion endpoint intentionally does not delete the Supabase Auth identity because that requires a privileged service-role workflow. The app tells the user that the authentication account remains active.

## Go-live checklist

- [ ] HTTPS is enabled.
- [ ] Production Supabase credentials are configured.
- [ ] PostgreSQL SSL is enabled and the CA is configured if required by the provider.
- [ ] `AUTH_REQUIRED=true`.
- [ ] Database migrations are applied.
- [ ] `/ready` returns HTTP 200 from the deployed container.
- [ ] OpenAI key is configured with appropriate spending limits.
- [ ] Stripe test-mode Checkout and webhook flows pass.
- [ ] `BILLING_ENABLED=true` only after both monthly and yearly prices are configured.
- [ ] `/health` reports the expected feature state.
- [ ] No secrets are present in Git history or the mobile bundle.
- [ ] Mobile `EXPO_PUBLIC_API_URL` points to the HTTPS API URL.
- [ ] EAS project is linked and `EXPO_TOKEN` is stored as a GitHub Actions secret before build/update workflows are used.
