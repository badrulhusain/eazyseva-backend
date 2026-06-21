const REQUIRED_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

const OPTIONAL_NUMBER_ENV_KEYS = [
  'PORT',
  'MAX_FILE_SIZE_MB',
  'CLOUDINARY_TIMEOUT_MS',
  'DOCUMENT_RETENTION_DAYS',
] as const;

function hasValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function validatePositiveInteger(
  config: Record<string, unknown>,
  key: (typeof OPTIONAL_NUMBER_ENV_KEYS)[number],
): void {
  const raw = config[key];
  if (!hasValue(raw)) return;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
}

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !hasValue(config[key]));
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  for (const key of OPTIONAL_NUMBER_ENV_KEYS) {
    validatePositiveInteger(config, key);
  }

  return config;
}
