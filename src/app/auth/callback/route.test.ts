/** @jest-environment node */

import { GET } from './route';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

describe('GET /auth/callback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exchanges a valid code and redirects to a safe internal path', async () => {
    const exchangeCodeForSession = jest.fn().mockResolvedValue({ error: null });
    (createClient as jest.Mock).mockResolvedValue({ auth: { exchangeCodeForSession } });
    const response = await GET(new Request('https://brightcart.test/auth/callback?code=valid&next=%2Fcheckout') as never);

    expect(exchangeCodeForSession).toHaveBeenCalledWith('valid');
    expect(response.headers.get('location')).toBe('https://brightcart.test/checkout');
  });

  it('rejects an external redirect destination and sends the user to login', async () => {
    const exchangeCodeForSession = jest.fn().mockResolvedValue({ error: null });
    (createClient as jest.Mock).mockResolvedValue({ auth: { exchangeCodeForSession } });
    const response = await GET(new Request('https://brightcart.test/auth/callback?code=valid&next=%2F%2Fevil.test') as never);

    expect(response.headers.get('location')).toBe('https://brightcart.test/account');
  });

  it('redirects to login with an error when code exchange fails', async () => {
    (createClient as jest.Mock).mockResolvedValue({ auth: { exchangeCodeForSession: jest.fn().mockResolvedValue({ error: new Error('expired') }) } });
    const response = await GET(new Request('https://brightcart.test/auth/callback?code=expired') as never);

    expect(response.headers.get('location')).toBe('https://brightcart.test/login?error=auth_callback');
  });
});