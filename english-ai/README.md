# StudyOS English AI

StudyOS is an AI-first English learning product built around one principle: **the student does not study English; they use English.**

## Architecture

- `apps/mobile`: Expo / React Native client
- `apps/api`: Express API, AI tutor, speech, realtime, adaptive learning and billing
- `database/schema.sql`: PostgreSQL schema

## Local development

### API

```bash
cd apps/api
npm install
cp .env.example .env
npm run dev
```

For a production-style API check:

```bash
npm run typecheck
```

### Mobile

```bash
cd apps/mobile
npm install
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_URL` to the API URL. Configure Supabase variables when authentication is enabled.

## Production checklist

1. Provision PostgreSQL and apply `database/schema.sql`.
2. Configure Supabase Auth and set `AUTH_REQUIRED=true`.
3. Set `CORS_ORIGINS` to the exact production app origins.
4. Set `TRUST_PROXY=true` only when the API is behind a trusted reverse proxy/load balancer.
5. Configure OpenAI API credentials and verify the selected models in the OpenAI model catalog before deployment.
6. Configure Stripe price, webhook secret, success/cancel URLs and customer portal return URL.
7. Configure Stripe webhook delivery to `/api/v1/billing/webhook`.
8. Keep all API secrets server-side; never place Stripe or OpenAI secret keys in the mobile app.
9. Run `npm run typecheck` before release.
10. Test sign-in, placement, daily lesson, tutor, voice, Smart Review and Stripe webhook flows in a staging environment.

## Core learning loop

Conversation → detect mistakes → create review → spaced review → targeted practice → conversation → progress update.

The daily lesson engine prioritizes due review items before generating reinforcement activities.

## Security

The API includes authentication middleware, CORS restrictions, security headers, request limits and a separate AI rate limit. The in-memory rate limiter is suitable for a single instance; multi-instance production should replace it with a shared store such as Redis.

## Billing

Stripe webhooks are signature-verified and subscription state is persisted in `billing_accounts`. Premium entitlements should be enforced at the API boundary before enabling paid-only capabilities.
