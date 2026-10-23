jest.mock('server-only', () => ({}));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from './admin';

describe('admin Supabase client', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  it('requires both server credentials', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createAdminClient()).toThrow('Supabase server credentials are not configured.');
  });

  it('creates a non-persistent service-role client', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.example.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    (createSupabaseClient as jest.Mock).mockReturnValue({ from: jest.fn() });

    createAdminClient();

    expect(createSupabaseClient).toHaveBeenCalledWith('https://db.example.test', 'service-role-test-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });
});