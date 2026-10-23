import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let pendingOrderId: number | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Please sign in before checkout.' }, { status: 401 });

    const body = await request.json();
    const address = body?.shippingAddress;
    const shippingMethod = body?.shippingMethod;
    if (!address || !['standard', 'expedited'].includes(shippingMethod)) {
      return NextResponse.json({ error: 'Provide a valid shipping address and shipping method.' }, { status: 400 });
    }

    // This authenticated RPC snapshots catalog prices and creates a pending order. No stock is decremented here.
    const { data: draft, error: draftError } = await supabase.rpc('create_stripe_checkout_order', {
      p_shipping_address: address,
      p_shipping_method: shippingMethod,
    });
    if (draftError) return NextResponse.json({ error: draftError.message }, { status: 400 });
    if (!draft?.order_id || !Array.isArray(draft.items) || draft.items.length === 0) {
      return NextResponse.json({ error: 'Could not prepare your order.' }, { status: 400 });
    }

    pendingOrderId = Number(draft.order_id);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: String(draft.order_id),
      customer_email: user.email || undefined,
      metadata: { order_id: String(draft.order_id), order_number: String(draft.order_number), user_id: user.id },
      line_items: [
        ...draft.items.map((item: { name: string; sku: string; quantity: number; unit_price: number | string }) => ({
          quantity: Number(item.quantity),
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(item.unit_price) * 100),
            product_data: { name: String(item.name), metadata: { sku: String(item.sku) } },
          },
        })),
        ...(Number(draft.shipping_fee) > 0 ? [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(draft.shipping_fee) * 100),
            product_data: { name: shippingMethod === 'expedited' ? 'Expedited shipping' : 'Standard shipping' },
          },
        }] : []),
      ],
      success_url: `${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      billing_address_collection: 'auto',
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'PK', 'AU'] },
      allow_promotion_codes: false,
    });

    const admin = createAdminClient();
    const { data: updatedPayment, error: paymentUpdateError } = await admin.from('payments')
      .update({ stripe_checkout_session_id: session.id, transaction_reference: session.id, updated_at: new Date().toISOString() })
      .eq('order_id', draft.order_id).eq('status', 'pending')
      .select('id').maybeSingle();
    if (paymentUpdateError) {
      console.error('Stripe checkout could not save its session to the payment row.', {
        orderId: draft.order_id,
        code: paymentUpdateError.code,
        message: paymentUpdateError.message,
        details: paymentUpdateError.details,
        hint: paymentUpdateError.hint,
      });
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw new Error('Could not save the Stripe session against the order.');
    }
    if (!updatedPayment) {
      console.error('Stripe checkout found no pending payment row to attach its session to.', { orderId: draft.order_id });
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw new Error('Could not find a pending payment for this order. Please try checkout again.');
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (pendingOrderId) {
      try {
        const admin = createAdminClient();
        await admin.from('orders').update({ status: 'cancelled' }).eq('id', pendingOrderId).eq('status', 'pending');
        await admin.from('payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('order_id', pendingOrderId).eq('status', 'pending');
      } catch { /* Keep the original checkout error; reconcile through logs if admin cleanup is unavailable. */ }
    }
    const message = error instanceof Error ? error.message : 'Unable to start secure checkout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
