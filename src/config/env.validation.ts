/**
 * Startup validation for the environment.
 *
 * Wired into `ConfigModule.forRoot({ validate: validateEnv })`, so it runs once
 * before any provider is constructed. Anything wrong here stops the boot with a
 * single readable list instead of surfacing later as a confusing runtime error:
 * a missing MONGODB_URI used to fail as a Mongoose connection timeout 30s in,
 * and a missing STRIPE_SECRET_KEY produced a `null` Stripe client whose first
 * symptom was a 500 on a guest's checkout.
 *
 * The rule for what belongs here: fail fast on anything whose absence breaks a
 * guest-visible flow, warn on anything that silently falls back to a default.
 */

const MIN_SECRET_LENGTH = 32;

/** Variables with no safe default, in every environment. */
const ALWAYS_REQUIRED = ['MONGODB_URI', 'JWT_SECRET'] as const;

/**
 * Variables that are only required in production. In development the services
 * that read them degrade on purpose: email logs instead of sending, and the
 * Stripe client is left null so the app boots without payment credentials.
 */
const PRODUCTION_REQUIRED = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'FRONTEND_URL',
] as const;

/**
 * Variables that have a hardcoded fallback. Running on the fallback is legal
 * but worth saying out loud, because the production fallbacks are the property's
 * own domains and a new deployment elsewhere will silently get the wrong ones.
 */
const PRODUCTION_RECOMMENDED = ['CORS_ORIGINS', 'RETURN_ORIGINS'] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  const value = (key: string): string => String(config[key] ?? '').trim();

  for (const key of ALWAYS_REQUIRED) {
    if (!value(key)) errors.push(`${key} is required`);
  }

  // The JWT secret is the one credential whose weakness is silent: a short
  // secret signs and verifies perfectly well and is simply guessable.
  const jwtSecret = value('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < MIN_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${jwtSecret.length}). ` +
        `Generate one with: openssl rand -base64 32`,
    );
  }

  if (isProduction) {
    for (const key of PRODUCTION_REQUIRED) {
      if (!value(key)) errors.push(`${key} is required when NODE_ENV=production`);
    }
    for (const key of PRODUCTION_RECOMMENDED) {
      if (!value(key)) warnings.push(`${key} is not set — falling back to the built-in defaults`);
    }
  }

  const mongoUri = value('MONGODB_URI');
  if (mongoUri && !/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  for (const key of ['PORT', 'TRUST_PROXY', 'MEMORY_WARNING_THRESHOLD', 'MEMORY_CHECK_INTERVAL']) {
    const raw = value(key);
    if (raw && !Number.isFinite(Number(raw))) {
      errors.push(`${key} must be a number (got "${raw}")`);
    }
  }

  const nodeEnv = value('NODE_ENV');
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(`NODE_ENV must be development, production or test (got "${nodeEnv}")`);
  }

  // Stripe keys are easy to cross-wire between environments, and a test key in
  // production means every real booking silently takes play money.
  const stripeKey = value('STRIPE_SECRET_KEY');
  if (isProduction && stripeKey.startsWith('sk_test_')) {
    errors.push('STRIPE_SECRET_KEY is a test key but NODE_ENV=production');
  }

  if (warnings.length) {
    // Logger is not available this early in the lifecycle.
    console.warn(`[config] ${warnings.join('\n[config] ')}`);
  }

  if (errors.length) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}\n` +
        `See .env.example for the full list of variables.`,
    );
  }

  return config;
}
