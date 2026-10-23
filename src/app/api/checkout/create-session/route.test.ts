/** @jest-environment node */

import { POST } from './route';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));
jest.mock('@/lib/stripe', () => ({ getStripe: jest.fn() }));

const shippingAddress = {
  fullName: 'Taylor Customer',
  phone: '5551234567',
  addressLine1: '12 Market Street',
  city: 'Lahore',
  postalCode: '54000',
  country: 'Pakistan',
};

const draft = {
  order_id: 52,
  order_number: 'ORD-52',
  shipping_fee: 5,
  items: [{ name: 'Lamp', sku: 'LAMP-1', quantity: 2, unit_price: '12.50' }],
};

describe('POST /api/checkout/create-session', () => {
  let stripe: { checkout: { sessions: { create: jest.Mock; expire: jest.Mock } } };
  let paymentQuery: Record<string, jest.Mock>;
  let supabase: { auth: { getUser: jest.Mock }; rpc: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    supabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'buyer@example.com' } } }) },
      rpc: jest.fn().mockResolvedValue({ data: draft, error: null }),
    };
    paymentQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 4 }, error: null }),
    };
    stripe = {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.test/session' }),
          expire: jest.fn().mockResolvedValue({}),
        },
      },
    };
    (createClient as jest.Mock).mockResolvedValue(supabase);
    (createAdminClient as jest.Mock).mockReturnValue({ from: jest.fn().mockReturnValue(paymentQuery) });
    (getStripe as jest.Mock).mockReturnValue(stripe);
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  function request(body: unknown) {
    return new Request('http://localhost/api/checkout/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('requires an authenticated user', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(request({ shippingAddress, shippingMethod: 'standard' }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Please sign in before checkout.' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects an invalid shipping method before creating an order', async () => {
    const response = await POST(request({ shippingAddress, shippingMethod: 'overnight' }));

    expect(response.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('requires a shipping address', async () => {
    const response = await POST(request({ shippingMethod: 'standard' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Provide a valid shipping address and shipping method.' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns the draft RPC error without creating a Stripe session', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Your cart is empty.' } });

    const response = await POST(request({ shippingAddress, shippingMethod: 'standard' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Your cart is empty.' });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects an empty order draft before contacting Stripe', async () => {
    supabase.rpc.mockResolvedValue({ data: { ...draft, items: [] }, error: null });

    const response = await POST(request({ shippingAddress, shippingMethod: 'standard' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Could not prepare your order.' });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('creates the Stripe session, stores its ID, and returns its URL', async () => {
    const response = await POST(request({ shippingAddress, shippingMethod: 'standard' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: 'https://checkout.stripe.test/session' });
    expect(supabase.rpc).toHaveBeenCalledWith('create_stripe_checkout_order', {
      p_shipping_address: shippingAddress,
      p_shipping_method: 'standard',
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      client_reference_id: '52',
      line_items: expect.arrayContaining([
        expect.objectContaining({ quantity: 2, price_data: expect.objectContaining({ unit_amount: 1250 }) }),
        expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ unit_amount: 500 }) }),
      ]),
    }));
    expect(paymentQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      stripe_checkout_session_id: 'cs_test_123',
      transaction_reference: 'cs_test_123',
    }));
    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
  });

  it('uses the configured site URL and omits free shipping from Stripe line items', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://shop.example.test';
    supabase.rpc.mockResolvedValue({ data: { ...draft, shipping_fee: 0 }, error: null });

    const response = await POST(request({ shippingAddress, shippingMethod: 'standard' }));

    expect(response.status).toBe(200);
    const options = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(options.line_items).toHaveLength(1);
    expect(options.success_url).toBe('https://shop.example.test/order-confirmation?session_id={CHECKOUT_SESSION_ID}');
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('labels and charges expedited shipping', async () => {
    const response = await POST(request({ shippingAddress, shippingMethod: 'expedited' }));

    expect(response.status).toBe(200);
    const options = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(options.line_items[1]).toEqual(expect.objectContaining({
      quantity: 1,
      price_data: expect.objectContaining({
        unit_amount: 500,
        product_data: expect.objectContaining({ name: 'Expedited shipping' }),
      }),
    }));
  });

  it('cancels the draft order if Stripe cannot create the session', async () => {
    stripe.checkout.sessions.create.mockRejectedValue(new Error('Stripe unavailable'));
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const adminFrom = jest.fn(() => ({ update, eq }));
    (createAdminClient as jest.Mock).mockReturnValue({ from: adminFrom });

    const response = await POST(request({ shippingAddress, shippingMethod: 'standard' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Stripe unavailable' });
    expect(adminFrom).toHaveBeenCalledWith('orders');
    expect(adminFrom).toHaveBeenCalledWith('payments');
    expect(update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('expires the Stripe session and returns an error when saving the payment row fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    paymentQuery.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied', details: null, hint: null } });

    const response = await POST(request({ shippingAddress, shippingMethod: 'standard' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Could not save the Stripe session against the order.' });
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_test_123');
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: '42501' }));
    consoleError.mockRestore();
  });

  it('reports when there is no pending payment row to update', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    paymentQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await POST(request({ shippingAddress, shippingMethod: 'standard' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Could not find a pending payment for this order. Please try checkout again.' });
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_test_123');
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), { orderId: 52 });
    consoleError.mockRestore();
  });
});