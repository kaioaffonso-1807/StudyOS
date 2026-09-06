# StudyOS Security Baseline

This document defines the minimum security checks required before connecting production credentials.

## Automated controls

- API CI: typecheck, tests, production build and Docker build.
- Mobile CI: TypeScript validation and Expo Doctor.
- CodeQL: JavaScript/TypeScript static analysis.
- Dependabot: dependency update proposals.
- Dependency Review: blocks risky dependency changes in pull requests.

## Secret handling

Never commit production credentials. Use environment variables or the secret store of the deployment provider.

In particular, do not expose:

- OpenAI API keys
- Stripe secret keys or webhook secrets
- database passwords
- Supabase service-role keys
- Expo tokens

Public mobile configuration must not contain server secrets.

## Production verification

Before release:

1. Run all CI workflows successfully.
2. Review CodeQL alerts.
3. Review Dependabot pull requests.
4. Verify HTTPS and allowed origins.
5. Verify authentication and authorization for every protected endpoint.
6. Verify rate limits and Free/Pro entitlements.
7. Test data export and deletion.
8. Test Stripe webhook signatures using the real environment.
9. Confirm logs do not contain credentials or personal data.
10. Perform a credential rotation rehearsal.

## Incident readiness

If a secret is exposed:

1. Revoke or rotate it immediately.
2. Remove it from deployment configuration.
3. Review access logs.
4. Open a security incident record.
5. Deploy replacement credentials.
6. Verify the affected integration.
