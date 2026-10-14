import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Per-developer identifiers come from the environment so they stay out of the repository.
 * Locally they are read from `.env.local` (gitignored, see `.env.example`); on EAS Build,
 * define them as EAS environment variables. EAS CLI doesn't load .env files on its own,
 * so the file is loaded here. Existing environment variables take precedence.
 */
try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: fall back to the environment and the defaults in app.json.
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const bundleId = process.env.APP_BUNDLE_ID;
  const projectId = process.env.EAS_PROJECT_ID;
  return {
    ...config,
    name: config.name ?? 'Net Worth',
    slug: config.slug ?? 'networth',
    ios: { ...config.ios, ...(bundleId && { bundleIdentifier: bundleId }) },
    android: { ...config.android, ...(bundleId && { package: bundleId }) },
    extra: { ...config.extra, ...(projectId && { eas: { projectId } }) },
  };
};
