# BrightCart — Next.js 15 + TypeScript + Supabase + Stripe Checkout

BrightCart is a database-backed ecommerce storefront built with the Next.js App Router. It includes email/password auth, product listing/detail pages, cart, shipping selection, Stripe-hosted card checkout, verified payment fulfillment, order confirmation, account/profile, and order history.

## Included
- Responsive homepage, catalog/PLP, PDP, cart, checkout, order confirmation, profile, order history.
- Email/password Supabase Auth with server-rendered session handling.
- 18 locally bundled SVG product illustrations (`public/images`), so product images work on localhost and deployments without an image host dependency.
- Standard shipping: free for subtotals >= $50, otherwise $5. Expedited shipping: $15.
- Stripe Checkout Sessions in test mode; payment details are entered on Stripe-hosted Checkout and never pass through this app's server.
- Server-only Stripe secret key and Supabase service role key; no secrets are exposed through `NEXT_PUBLIC_*`.
- Server-side Stripe session verification on the order-confirmation return, with order/session/amount/currency/user matching and idempotent database fulfillment. A signed webhook is optional for customers who do not return to the site.
- Supabase migration included at `supabase/migrations/202610190001_stripe_checkout_and_shipping.sql` and applied to project `ruwlciojkbdhpgwhnpjr`.

## Requirements
- Node.js 20.9+
- Access to the existing Supabase project
- Stripe test-mode keys

## Local setup (Windows PowerShell)

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Fill `.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ruwlciojkbdhpgwhnpjr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_rotated_test_secret
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Security:** The Stripe secret key shared in the chat should be considered exposed. Rotate it in Stripe Dashboard before use, then put the replacement only in `.env.local` and your deployment's server-side environment settings. Never commit `.env.local`; never use `NEXT_PUBLIC_STRIPE_SECRET_KEY` or `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. The Stripe publishable key is not needed for this hosted Checkout flow, because the browser is redirected to Stripe's hosted payment page.

## Stripe setup

1. In Stripe Dashboard, confirm you are in **Test mode** and create/rotate a test secret key. Put it in `STRIPE_SECRET_KEY`.
2. No Stripe CLI or webhook secret is required for normal card checkout. After a successful payment, the order-confirmation page retrieves and verifies the Checkout Session directly with Stripe, then finalizes the order in Supabase.

3. Optionally, configure a Stripe webhook for additional reliability if a customer pays but does not return to the confirmation page. For local webhook testing, install Stripe CLI and run in a second terminal:

   ```powershell
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   If you want to test the optional webhook locally, copy the `whsec_...` printed by Stripe CLI into `STRIPE_WEBHOOK_SECRET` in `.env.local`, then restart the Next.js server.
4. For optional deployed webhook reliability, create an endpoint at `https://YOUR_DEPLOYED_DOMAIN/api/stripe/webhook` in Stripe Dashboard and subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`

   Only if you enable this optional endpoint, copy its signing secret into the deployed `STRIPE_WEBHOOK_SECRET` setting. Set `NEXT_PUBLIC_SITE_URL` to your deployed HTTPS origin.
5. Set `SUPABASE_SERVICE_ROLE_KEY` to the service-role/secret key from Supabase Dashboard → Project Settings → API Keys. It is read only by server-side modules. Do not use it in browser code.
6. Test with Stripe's standard test card `4242 4242 4242 4242`, any future expiry, and any CVC while in test mode.

## Shipping and order flow

- The authenticated `create_stripe_checkout_order` RPC reads the active cart and current product prices from Supabase, validates stock/address, snapshots an order as `pending`, and records pending payment data. It does not decrement stock.
- The server creates a Stripe Checkout Session from those database-derived line items and stores the session ID on the matching payment row.
- After Stripe returns a customer to `/order-confirmation`, the server retrieves the session directly from Stripe and validates the session and stored order before calling `finalize_stripe_checkout`. The RPC locks the order, validates stock, marks payment paid, confirms the order, decrements stock, and converts/clears the cart atomically.
- The optional webhook provides the same idempotent fulfillment if a customer pays but does not return to the site, and handles expired/asynchronous sessions when configured.
- Standard shipping is $5 under $50 and free at/over $50. Expedited shipping is $15. These fees are calculated on the database side, not trusted from the browser.

## Supabase auth redirect setup

In Supabase Authentication → URL Configuration, set the local Site URL to `http://localhost:3000` and allow `http://localhost:3000/**`. Add your production HTTPS URL when deployed. Enable the Email provider. If email confirmation is enabled, verify the signup email before logging in.

## Validation status

The database migration was applied and the RPCs were verified to exist. The Stripe routes and UI are included in this archive. A complete Stripe payment/browser test and production Next.js build still need to be run in your environment after installing dependencies and configuring the server-only keys.


## Stripe checkout without Stripe CLI

The app does not require Stripe CLI. For a successful immediate card payment, `/order-confirmation` retrieves the Checkout Session directly from Stripe on the server, verifies its user/order/session/amount/currency against Supabase, and calls the idempotent `finalize_stripe_checkout` RPC. This allows local end-to-end test-card checkout without a CLI listener.

The signed `/api/stripe/webhook` endpoint is optional. The app does not require a webhook endpoint or `STRIPE_WEBHOOK_SECRET` for normal card checkout: the success page verifies and finalizes the payment directly. Configure the optional endpoint if you want webhook-based recovery when a customer pays but does not return to the success page.

### Environment setup

Copy `.env.example` to `.env.local` and replace all `REPLACE` / `YOUR_` values. The Stripe secret previously pasted into chat is treated as exposed and is deliberately not embedded in this ZIP; rotate it in Stripe Dashboard and use the new test secret. The Supabase service-role key is not available from the project URL or publishable key and must be copied from Supabase Project Settings → API Keys. Keep it server-only.

Local and deployed card checkout require `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `STRIPE_SECRET_KEY`. `STRIPE_WEBHOOK_SECRET` is optional and only needed if the optional webhook endpoint is configured. The public Stripe publishable key is included only as a configuration slot; Checkout Sessions are created server-side and redirect to Stripe-hosted Checkout.
