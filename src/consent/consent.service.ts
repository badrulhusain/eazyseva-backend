import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CURRENT_POLICY_VERSION,
  TERMS_TEXT_SNAPSHOT,
} from './consent.constants';
import type { AcceptConsentDto } from './dto/accept-consent.dto';

export interface AcceptResult {
  accepted: true;
  policyVersion: string;
}

export interface StatusResult {
  accepted: boolean;
  currentPolicyVersion: string;
  acceptedAt: string | null;
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async accept(
    userId: string,
    dto: AcceptConsentDto,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<AcceptResult> {
    // Idempotent: a prior acceptance of the same (user, policyVersion) is a no-op.
    const { data: existing, error: lookupError } =
      await this.supabaseService.admin
        .from('consent_acceptances')
        .select('id')
        .eq('user_id', userId)
        .eq('policy_version', dto.policyVersion)
        .maybeSingle();

    if (lookupError) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: lookupError.message,
      });
    }

    if (!existing) {
      const { error: insertError } = await this.supabaseService.admin
        .from('consent_acceptances')
        .insert({
          user_id: userId,
          policy_version: dto.policyVersion,
          consent_text_snapshot: TERMS_TEXT_SNAPSHOT,
          source: dto.source,
          ip_address: ipAddress,
          user_agent: userAgent,
        });

      if (insertError) {
        throw new InternalServerErrorException({
          code: 'DB_ERROR',
          message: insertError.message,
        });
      }

      this.logger.log(
        `Consent recorded: user=${userId} policyVersion=${dto.policyVersion} source=${dto.source}`,
      );

      // Only the latest policy version flips the convenience flag on the profile —
      // accepting an older/superseded version doesn't mean the user is up to date.
      if (dto.policyVersion === CURRENT_POLICY_VERSION) {
        const { error: profileError } = await this.supabaseService.admin
          .from('profiles')
          .update({ accepted_latest_policy: true })
          .eq('id', userId);

        if (profileError) {
          this.logger.error(
            `Failed to set accepted_latest_policy for user=${userId}: ${profileError.message}`,
          );
        }
      }
    }

    return { accepted: true, policyVersion: dto.policyVersion };
  }

  async getStatus(userId: string): Promise<StatusResult> {
    const { data, error } = await this.supabaseService.admin
      .from('consent_acceptances')
      .select('accepted_at')
      .eq('user_id', userId)
      .eq('policy_version', CURRENT_POLICY_VERSION)
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    return {
      accepted: !!data,
      currentPolicyVersion: CURRENT_POLICY_VERSION,
      acceptedAt: (data?.accepted_at as string | undefined) ?? null,
    };
  }
}
