# Release Candidate Checklist

## Automated gates
- [ ] API CI is green.
- [ ] Mobile CI is green.
- [ ] CodeQL alerts are reviewed.
- [ ] Dependency Review passes for dependency changes.
- [ ] Dependabot updates are reviewed.

## Functional smoke tests
- [ ] Sign up and sign in.
- [ ] Password recovery deep link.
- [ ] Placement submission.
- [ ] Personalized lesson loading.
- [ ] Text conversation.
- [ ] Voice conversation.
- [ ] Progress refresh.
- [ ] Free/Pro usage limits.
- [ ] Billing return refresh.
- [ ] Data export.
- [ ] Data deletion.

## Production-only gates
- [ ] Production environment validation succeeds.
- [ ] HTTPS and allowed origins are configured.
- [ ] Database migrations are applied.
- [ ] Stripe webhook signature is verified.
- [ ] Logs contain no secrets or access tokens.
- [ ] Android build tested on a physical device.
- [ ] iOS build tested on a physical device.
