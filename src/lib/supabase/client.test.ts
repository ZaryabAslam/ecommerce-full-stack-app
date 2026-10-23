import { createBrowserClient } from '@supabase/ssr';
import { createClient } from './client';

jest.mock('@supabase/ssr', () => ({ createBrowserClient: jest.fn() }));

describe('browser Supabase client', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it('creates a browser client with the public project configuration', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.example.test';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
    (createBrowserClient as jest.Mock).mockReturnValue({ auth: {} });

    const client = createClient();

    expect(client).toEqual({ auth: {} });
    expect(createBrowserClient).toHaveBeenCalledWith('https://db.example.test', 'public-test-key');
  });
});