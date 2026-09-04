# StudyOS Mobile — EAS release runbook

The project stays on Expo SDK 54. The SDK 54 documentation recommends `expo-updates` `~29.0.20`; the dependency is pinned accordingly.

## One-time setup

1. Create/sign in to an Expo account.
2. From `english-ai/apps/mobile`, run `npx eas-cli init` and link the app to the Expo project.
3. Run `npx eas-cli update:configure` to write the EAS Update project URL into the app configuration.
4. Create a GitHub Actions secret named `EXPO_TOKEN`.
5. Configure EAS environment variables for `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Do not commit Expo tokens or production secrets.

## Production build

Run locally:

```bash
cd english-ai/apps/mobile
npx eas-cli build --platform all --profile production
```

Or use the GitHub Actions `StudyOS Mobile Build` workflow.

A production build is required before the app can receive EAS Updates because `expo-updates` is part of the native binary.

## JavaScript/asset update

Use the GitHub Actions `StudyOS Mobile Update` workflow, or:

```bash
npx eas-cli update --channel production --message "Describe the release"
```

Only non-native changes should be shipped through EAS Update. Native dependency/configuration changes require a new Android/iOS build.

## Release channels

- `development` — development clients
- `preview` — internal distribution
- `production` — store/release builds

The production build profile is already bound to the `production` channel in `eas.json`.
