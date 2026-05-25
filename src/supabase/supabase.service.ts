import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly adminClient: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
