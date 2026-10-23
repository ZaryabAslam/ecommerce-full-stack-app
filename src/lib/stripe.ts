import 'server-only';
import Stripe from 'stripe';

let stripeClient: Stripe | undefined;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured on the server.');
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}
