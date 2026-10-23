-- Applied to Supabase project ruwlciojkbdhpgwhnpjr as migration stripe_checkout_and_shipping.
-- Adds Stripe metadata and secure, server-authoritative checkout RPCs without replacing existing tables.
alter table public.orders add column if not exists shipping_method text not null default 'standard';
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists currency text not null default 'usd';
alter table public.payments add column if not exists stripe_event_id text;
alter table public.payments add column if not exists updated_at timestamptz not null default now();
create unique index if not exists payments_stripe_checkout_session_unique on public.payments (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists payments_stripe_event_unique on public.payments (stripe_event_id) where stripe_event_id is not null;
create index if not exists orders_user_created_desc_idx on public.orders (user_id, created_at desc);

create or replace function public.create_stripe_checkout_order(p_shipping_address jsonb,p_shipping_method text default 'standard')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid:=auth.uid(); v_cart_id bigint; v_order_id bigint; v_order_number text; v_subtotal numeric(12,2); v_shipping numeric(12,2); v_total numeric(12,2); v_items jsonb;
begin
 if v_user_id is null then raise exception 'Please sign in before checkout.'; end if;
 if p_shipping_method not in ('standard','expedited') then raise exception 'Invalid shipping method.'; end if;
 if p_shipping_address is null or pg_catalog.jsonb_typeof(p_shipping_address)<>'object'
 or pg_catalog.length(pg_catalog.btrim(coalesce(p_shipping_address->>'fullName','')))<2
 or pg_catalog.length(pg_catalog.btrim(coalesce(p_shipping_address->>'phone','')))<5
 or pg_catalog.length(pg_catalog.btrim(coalesce(p_shipping_address->>'addressLine1','')))<3
 or pg_catalog.length(pg_catalog.btrim(coalesce(p_shipping_address->>'city','')))<2
 or pg_catalog.length(pg_catalog.btrim(coalesce(p_shipping_address->>'postalCode','')))<2
 or pg_catalog.length(pg_catalog.btrim(coalesce(p_shipping_address->>'country','')))<2 then raise exception 'Please provide a complete shipping address.'; end if;
 select c.id into v_cart_id from public.carts c where c.user_id=v_user_id and c.status='active' order by c.id desc limit 1 for update;
 if v_cart_id is null or not exists(select 1 from public.cart_items ci where ci.cart_id=v_cart_id) then raise exception 'Your cart is empty.'; end if;
 if exists(select 1 from public.cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=v_cart_id and (p.active=false or ci.quantity<1 or ci.quantity>p.stock_quantity)) then raise exception 'One or more products are unavailable or out of stock.'; end if;
 select coalesce(sum(ci.quantity*p.price),0)::numeric(12,2) into v_subtotal from public.cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=v_cart_id and p.active=true;
 v_shipping:=case when p_shipping_method='expedited' then 15.00 when v_subtotal>=50 then 0.00 else 5.00 end; v_total:=v_subtotal+v_shipping;
 v_order_number:='ORD-'||pg_catalog.to_char(pg_catalog.clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,6));
 insert into public.orders(user_id,order_number,status,subtotal,shipping_fee,tax,total,shipping_address,checkout_cart_id,shipping_method,currency) values(v_user_id,v_order_number,'pending',v_subtotal,v_shipping,0,v_total,p_shipping_address,v_cart_id,p_shipping_method,'usd') returning id into v_order_id;
 insert into public.order_items(order_id,product_id,product_name,sku,quantity,unit_price,cart_item_id) select v_order_id,p.id,p.name,p.sku,ci.quantity,p.price,ci.id from public.cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=v_cart_id and p.active=true;
 insert into public.payments(order_id,payment_method,status,amount,transaction_reference) values(v_order_id,'card','pending',v_total,'STRIPE-PENDING-'||v_order_number);
 select coalesce(jsonb_agg(jsonb_build_object('name',p.name,'sku',p.sku,'quantity',ci.quantity,'unit_price',p.price) order by p.name),'[]'::jsonb) into v_items from public.cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=v_cart_id and p.active=true;
 return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'shipping_fee',v_shipping,'total',v_total,'currency','usd','items',v_items);
end; $$;

create or replace function public.finalize_stripe_checkout(p_order_id bigint,p_session_id text,p_payment_intent_id text,p_event_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_payment public.payments%rowtype; v_expected integer; v_updated integer;
begin
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found.'; end if;
 select * into v_payment from public.payments where order_id=p_order_id for update;
 if not found or v_payment.stripe_checkout_session_id is distinct from p_session_id then raise exception 'Stripe session does not match this order.'; end if;
 if v_order.status='confirmed' and v_payment.status='paid' then return jsonb_build_object('ok',true,'already_processed',true,'order_number',v_order.order_number); end if;
 if v_order.status<>'pending' or v_payment.status<>'pending' then raise exception 'Order is not awaiting payment.'; end if;
 select count(*)::integer into v_expected from public.order_items where order_id=p_order_id and product_id is not null;
 update public.products p set stock_quantity=p.stock_quantity-oi.quantity from public.order_items oi where oi.order_id=p_order_id and oi.product_id=p.id and p.active=true and p.stock_quantity>=oi.quantity;
 get diagnostics v_updated = row_count;
 if v_updated <> v_expected then raise exception 'Stock changed before payment could be fulfilled; manual review/refund may be required.'; end if;
 update public.orders set status='confirmed',paid_at=pg_catalog.now() where id=p_order_id;
 update public.payments set status='paid',stripe_payment_intent_id=p_payment_intent_id,stripe_event_id=coalesce(stripe_event_id,p_event_id),transaction_reference=p_payment_intent_id,updated_at=pg_catalog.now() where order_id=p_order_id;
 update public.carts set status='converted',updated_at=pg_catalog.now() where id=v_order.checkout_cart_id and user_id=v_order.user_id;
 delete from public.cart_items where cart_id=v_order.checkout_cart_id;
 return jsonb_build_object('ok',true,'already_processed',false,'order_number',v_order.order_number);
end; $$;

create or replace function public.expire_stripe_checkout(p_session_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_order_id bigint;
begin
 select order_id into v_order_id from public.payments where stripe_checkout_session_id=p_session_id and status='pending';
 if v_order_id is null then return false; end if;
 update public.orders set status='cancelled' where id=v_order_id and status='pending';
 update public.payments set status='failed',updated_at=pg_catalog.now() where order_id=v_order_id and status='pending';
 return true;
end; $$;

revoke all on function public.create_stripe_checkout_order(jsonb,text) from public,anon;
grant execute on function public.create_stripe_checkout_order(jsonb,text) to authenticated;
revoke all on function public.finalize_stripe_checkout(bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_stripe_checkout(bigint,text,text,text) to service_role;
revoke all on function public.expire_stripe_checkout(text) from public,anon,authenticated;
grant execute on function public.expire_stripe_checkout(text) to service_role;
