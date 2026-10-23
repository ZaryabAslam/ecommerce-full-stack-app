import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook signature configuration is missing.' }, { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid') return NextResponse.json({ received: true, waiting_for_payment: true });
      const orderId = Number(session.metadata?.order_id);
      if (!Number.isSafeInteger(orderId) || orderId <= 0 || !session.amount_total || session.currency !== 'usd') {
        return NextResponse.json({ error: 'Checkout session metadata or currency is invalid.' }, { status: 400 });
      }
      const { data: payment, error: paymentError } = await admin.from('payments')
        .select('order_id,amount,stripe_checkout_session_id').eq('order_id', orderId).single();
      const { data: order, error: orderError } = await admin.from('orders')
        .select('user_id,total,currency').eq('id', orderId).single();
      if (paymentError || orderError || !payment || !order || order.user_id !== session.metadata?.user_id || payment.stripe_checkout_session_id !== session.id || Math.round(Number(payment.amount) * 100) !== session.amount_total || Math.round(Number(order.total) * 100) !== session.amount_total || order.currency !== 'usd') {
        return NextResponse.json({ error: 'Checkout session does not match the stored order amount.' }, { status: 400 });
      }
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      const { error } = await admin.rpc('finalize_stripe_checkout', {
        p_order_id: orderId,
        p_session_id: session.id,
        p_payment_intent_id: paymentIntentId || '',
        p_event_id: event.id,
      });
      if (error) throw error;
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { error } = await admin.rpc('expire_stripe_checkout', { p_session_id: session.id });
      if (error) throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
