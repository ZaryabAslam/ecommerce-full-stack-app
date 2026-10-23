import { render, screen } from '@testing-library/react';
import OrderConfirmationPage from './page';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
jest.mock('next/navigation', () => ({ redirect: jest.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));
jest.mock('@/lib/stripe', () => ({ getStripe: jest.fn() }));

describe('OrderConfirmationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const paidSession = {
      id: 'cs_test_101',
      mode: 'payment',
      currency: 'usd',
      payment_status: 'paid',
      amount_total: 4200,
      payment_intent: 'pi_test_101',
      metadata: { user_id: 'user-101', order_id: '101' },
    };
    const order = { id: 101, user_id: 'user-101', order_number: 'ORD-101', status: 'pending', total: '42.00', currency: 'usd' };
    const payment = { order_id: 101, amount: '42.00', status: 'pending', stripe_checkout_session_id: 'cs_test_101' };
    (getStripe as jest.Mock).mockReturnValue({ checkout: { sessions: { retrieve: jest.fn().mockResolvedValue(paidSession) } } });
    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-101' } } }) },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { ...order, status: 'confirmed' }, error: null }),
      })),
    });
    (createAdminClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: table === 'payments' ? payment : order, error: null }),
      })),
      rpc: jest.fn().mockResolvedValue({ error: null }),
    });
  });

  it('verifies and finalizes a paid session without STRIPE_WEBHOOK_SECRET', async () => {
    const page = await OrderConfirmationPage({ searchParams: Promise.resolve({ session_id: 'cs_test_101' }) });
    render(page);

    expect(await screen.findByText('PAYMENT CONFIRMED')).toBeInTheDocument();
    expect(screen.getByText('ORD-101')).toBeInTheDocument();
    expect(createAdminClient).toHaveBeenCalled();
    const admin = (createAdminClient as jest.Mock).mock.results[0].value;
    expect(admin.rpc).toHaveBeenCalledWith('finalize_stripe_checkout', {
      p_order_id: 101,
      p_session_id: 'cs_test_101',
      p_payment_intent_id: 'pi_test_101',
      p_event_id: 'return_cs_test_101',
    });
  });
});