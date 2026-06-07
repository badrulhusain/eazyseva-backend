import { ConsentService } from './consent.service';
import {
  CURRENT_POLICY_VERSION,
  TERMS_TEXT_SNAPSHOT,
} from './consent.constants';
import type { AcceptConsentDto } from './dto/accept-consent.dto';

// Minimal SupabaseService mock — chainable query builder, resolves per-table.
function buildSupabaseMock(opts: {
  existingAcceptance: { id: string } | null;
  insertError?: { message: string } | null;
  profileUpdateError?: { message: string } | null;
}) {
  const insert = jest
    .fn()
    .mockResolvedValue({ error: opts.insertError ?? null });
  const update = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: opts.profileUpdateError ?? null }),
  });

  const consentChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest
      .fn()
      .mockResolvedValue({ data: opts.existingAcceptance, error: null }),
    insert,
  };

  const profilesChain: any = { update };

  const from = jest.fn((table: string) =>
    table === 'profiles' ? profilesChain : consentChain,
  );

  return {
    supabaseService: { admin: { from } } as any,
    consentChain,
    insert,
    update,
  };
}

const dto: AcceptConsentDto = {
  policyVersion: CURRENT_POLICY_VERSION,
  source: 'email_login',
};

describe('ConsentService', () => {
  describe('accept', () => {
    it('inserts a new acceptance with the backend snapshot and flips accepted_latest_policy', async () => {
      const { supabaseService, insert, update } = buildSupabaseMock({
        existingAcceptance: null,
      });
      const service = new ConsentService(supabaseService);

      const result = await service.accept(
        'user-1',
        dto,
        '1.2.3.4',
        'jest-agent',
      );

      expect(result).toEqual({
        accepted: true,
        policyVersion: CURRENT_POLICY_VERSION,
      });
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          policy_version: CURRENT_POLICY_VERSION,
          consent_text_snapshot: TERMS_TEXT_SNAPSHOT,
          source: 'email_login',
          ip_address: '1.2.3.4',
          user_agent: 'jest-agent',
        }),
      );
      expect(update).toHaveBeenCalledWith({ accepted_latest_policy: true });
    });

    it('is idempotent — does not insert again when (user, policyVersion) already accepted', async () => {
      const { supabaseService, insert, update } = buildSupabaseMock({
        existingAcceptance: { id: 'existing-1' },
      });
      const service = new ConsentService(supabaseService);

      const result = await service.accept(
        'user-1',
        dto,
        '1.2.3.4',
        'jest-agent',
      );

      expect(result).toEqual({
        accepted: true,
        policyVersion: CURRENT_POLICY_VERSION,
      });
      expect(insert).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('returns accepted=true with the acceptedAt timestamp when a row exists', async () => {
      const { supabaseService, consentChain } = buildSupabaseMock({
        existingAcceptance: null,
      });
      consentChain.maybeSingle.mockResolvedValueOnce({
        data: { accepted_at: '2026-06-01T00:00:00Z' },
        error: null,
      });
      const service = new ConsentService(supabaseService);

      const result = await service.getStatus('user-1');

      expect(result).toEqual({
        accepted: true,
        currentPolicyVersion: CURRENT_POLICY_VERSION,
        acceptedAt: '2026-06-01T00:00:00Z',
      });
    });

    it('returns accepted=false with acceptedAt=null when no row exists', async () => {
      const { supabaseService, consentChain } = buildSupabaseMock({
        existingAcceptance: null,
      });
      consentChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      const service = new ConsentService(supabaseService);

      const result = await service.getStatus('user-1');

      expect(result).toEqual({
        accepted: false,
        currentPolicyVersion: CURRENT_POLICY_VERSION,
        acceptedAt: null,
      });
    });
  });
});
