import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from './server';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

describe('server Supabase client', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it('provides cookie reads and writes to Supabase', async () => {
    const cookieValues = [{ name: 'session', value: 'cookie-value' }];
    const set = jest.fn();
    const cookieStore = { getAll: jest.fn().mockReturnValue(cookieValues), set };
    (cookies as jest.Mock).mockResolvedValue(cookieStore);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.example.test';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
    (createServerClient as jest.Mock).mockImplementation((_url, _key, options) => {
      expect(options.cookies.getAll()).toEqual(cookieValues);
      options.cookies.setAll([{ name: 'session', value: 'updated', options: { path: '/' } }]);
      return { auth: {} };
    });

    await createClient();

    expect(createServerClient).toHaveBeenCalledWith('https://db.example.test', 'public-test-key', expect.any(Object));
    expect(set).toHaveBeenCalledWith('session', 'updated', { path: '/' });
  });

  it('ignores cookie write failures in server-component contexts', async () => {
    (cookies as jest.Mock).mockResolvedValue({ getAll: jest.fn().mockReturnValue([]), set: jest.fn(() => { throw new Error('read-only cookies'); }) });
    (createServerClient as jest.Mock).mockImplementation((_url, _key, options) => {
      expect(() => options.cookies.setAll([{ name: 'session', value: 'new', options: {} }])).not.toThrow();
      return { auth: {} };
    });

    await expect(createClient()).resolves.toEqual({ auth: {} });
  });
});