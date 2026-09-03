# StudyOS English AI

StudyOS English AI is an adaptive English-learning platform built around a personal AI tutor.

## Current architecture

- `english-ai/apps/api` — TypeScript/Express API
- `english-ai/apps/mobile` — Expo/React Native client
- `english-ai/database` — PostgreSQL schema

## Core capabilities

- CEFR-based adaptive learning
- Personalized daily lessons
- AI tutor conversations
- Learner memory and recurring mistakes
- Progress scoring across speaking, listening, grammar, vocabulary and pronunciation
- Speech transcription and synthesis
- OpenAI Realtime voice conversations
- Supabase authentication
- PostgreSQL/Supabase persistence

## Local development

### API

```bash
cd english-ai/apps/api
npm install
cp .env.example .env
npm run dev
```

The API listens on port `4000` by default.

### Mobile

```bash
cd english-ai/apps/mobile
npm install
cp .env.example .env
npm start
```

## Environment and security

Never commit `.env` files or API keys. Use the example environment files as templates and store production secrets in the deployment provider's secret manager.

For production, set `AUTH_REQUIRED=true` and configure Supabase authentication and a managed PostgreSQL database.

## Project status

The current branch contains the English AI MVP foundation. Production hardening, automated tests, billing, observability and deployment are the next engineering layers.
