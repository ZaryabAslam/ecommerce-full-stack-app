jest.mock('server-only', () => ({}));
jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }));

import Stripe from 'stripe';
import { getStripe } from './stripe';

describe('Stripe client', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it('requires the server secret key', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => getStripe()).toThrow('STRIPE_SECRET_KEY is not configured on the server.');
  });

  it('creates and reuses one Stripe SDK client', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_only';
    (Stripe as unknown as jest.Mock).mockClear();
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({ checkout: {} }));

    const first = getStripe();
    const second = getStripe();

    expect(first).toBe(second);
    expect(Stripe).toHaveBeenCalledTimes(1);
    expect(Stripe).toHaveBeenCalledWith('sk_test_only');
  });
});