import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly client: SupabaseClient;
  private readonly adminClient: SupabaseClient;

  constructor() {
    // Validate required env vars at startup rather than failing silently
    // on the first request.
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) throw new Error('Missing env var: SUPABASE_URL');
    if (!anonKey) throw new Error('Missing env var: SUPABASE_ANON_KEY');

    if (!serviceRoleKey) {
      // Without the service-role key the admin client will use the anon key,
      // meaning it respects RLS policies. This is a misconfiguration for
      // production but acceptable for local dev when RLS is disabled.
      this.logger.warn(
        'SUPABASE_SERVICE_ROLE_KEY is not set — admin client will use anon key (RLS enforced)',
      );
    }

    this.client = createClient(url, anonKey);
    this.adminClient = createClient(url, serviceRoleKey ?? anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Anon-key client — respects RLS policies. */
  get supabase(): SupabaseClient {
    return this.client;
  }

  /** Service-role client — bypasses RLS. Use only in trusted server code. */
  get admin(): SupabaseClient {
    return this.adminClient;
  }
}
