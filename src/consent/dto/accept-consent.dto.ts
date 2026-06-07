import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Mirrors the client's ConsentSource union (features/auth/constants/policy.ts) —
// 'policy_modal'/'session_restore' cover an already-authenticated user accepting
// via the in-app policy modal or on session restore, alongside the login-flow sources.
export const CONSENT_SOURCES = [
  'email_login',
  'google_oauth',
  'session_restore',
  'policy_modal',
] as const;

export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export class AcceptConsentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  policyVersion: string;

  @IsIn(CONSENT_SOURCES, {
    message: `source must be one of: ${CONSENT_SOURCES.join(', ')}`,
  })
  source: ConsentSource;
}
