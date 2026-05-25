import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService {
    private readonly client;
    private readonly adminClient;
    constructor();
    get supabase(): SupabaseClient;
    get admin(): SupabaseClient;
}
