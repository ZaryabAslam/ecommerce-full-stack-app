/** @jest-environment node */

import { POST } from './route';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

jest.mock('@/lib/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));

describe('POST /api/stripe/webhook', () => {
  let constructEvent: jest.Mock;
  let rpc: jest.Mock;
  let payment: Record<string, unknown>;
  let order: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    constructEvent = jest.fn();
    rpc = jest.fn().mockResolvedValue({ error: null });
    payment = { order_id: 27, amount: '42.00', stripe_checkout_session_id: 'cs_test_27' };
    order = { user_id: 'user-27', total: '42.00', currency: 'usd' };

    (getStripe as jest.Mock).mockReturnValue({ webhooks: { constructEvent } });
    (createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: table === 'payments' ? payment : order, error: null }),
      }),
      rpc,
    });
  });

  function request(signature?: string) {
    return new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: signature ? { 'stripe-signature': signature } : {},
      body: 'signed webhook payload',
    });
  }

  it('rejects a missing signature without processing an event', async () => {
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Webhook signature configuration is missing.' });
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it('rejects invalid Stripe signatures', async () => {
    constructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });
    const response = await POST(request('bad-signature'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid signature' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('uses a generic message when signature verification throws a non-Error value', async () => {
    constructEvent.mockImplementation(() => { throw 'invalid'; });

    const response = await POST(request('bad-signature'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid webhook signature' });
  });

  it('waits for Stripe to mark the session paid before finalizing', async () => {
    constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { payment_status: 'unpaid' } } });
    const response = await POST(request('valid-signature'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, waiting_for_payment: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('validates stored order ownership and amount before finalizing payment', async () => {
    const session = {
      id: 'cs_test_27',
      payment_status: 'paid',
      metadata: { order_id: '27', user_id: 'user-27' },
      amount_total: 4200,
      currency: 'usd',
      payment_intent: 'pi_test_27',
    };
    constructEvent.mockReturnValue({ id: 'evt_test_27', type: 'checkout.session.completed', data: { object: session } });

    const response = await POST(request('valid-signature'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(rpc).toHaveBeenCalledWith('finalize_stripe_checkout', {
      p_order_id: 27,
      p_session_id: 'cs_test_27',
      p_payment_intent_id: 'pi_test_27',
      p_event_id: 'evt_test_27',
    });
  });

  it('rejects a payment amount that does not match the stored order', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_test_27',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_27', payment_status: 'paid', metadata: { order_id: '27', user_id: 'user-27' }, amount_total: 5000, currency: 'usd' } },
    });

    const response = await POST(request('valid-signature'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Checkout session does not match the stored order amount.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ order_id: 'invalid', user_id: 'user-27' }, 4200, 'usd'],
    [{ order_id: '27', user_id: 'wrong-user' }, 4200, 'usd'],
    [{ order_id: '27', user_id: 'user-27' }, null, 'usd'],
    [{ order_id: '27', user_id: 'user-27' }, 4200, 'eur'],
  ])('rejects invalid metadata, amount, or currency', async (metadata, amount, currency) => {
    constructEvent.mockReturnValue({
      id: 'evt_invalid',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_27', payment_status: 'paid', metadata, amount_total: amount, currency } },
    });

    const response = await POST(request('valid-signature'));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('expires a session through the database RPC', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_expired',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_27' } },
    });

    const response = await POST(request('valid-signature'));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('expire_stripe_checkout', { p_session_id: 'cs_test_27' });
  });

  it('returns a retryable server error when payment finalization fails', async () => {
    rpc.mockResolvedValue({ error: new Error('Order is not awaiting payment.') });
    constructEvent.mockReturnValue({
      id: 'evt_test_27',
      type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_test_27', payment_status: 'paid', metadata: { order_id: '27', user_id: 'user-27' },
        amount_total: 4200, currency: 'usd', payment_intent: null,
      } },
    });

    const response = await POST(request('valid-signature'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Order is not awaiting payment.' });
    expect(rpc).toHaveBeenCalledWith('finalize_stripe_checkout', expect.objectContaining({ p_payment_intent_id: '' }));
  });
});