import { getActiveCart } from './cart';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

describe('getActiveCart', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty cart for a signed-out visitor without querying cart tables', async () => {
    const from = jest.fn();
    (createClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) }, from });

    await expect(getActiveCart()).resolves.toEqual({ user: null, cartId: null, lines: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it('creates an active cart when needed and excludes cart lines without a product', async () => {
    const cart = { id: 8 };
    const createdCart = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: cart, error: null }),
    };
    const cartItems = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [
        { id: 1, cart_id: 8, product_id: 4, quantity: 1, unit_price: 10, product: { id: 4, name: 'Mug' } },
        { id: 2, cart_id: 8, product_id: 9, quantity: 1, unit_price: 10, product: null },
      ], error: null }),
    };
    const activeCart = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    let cartQueryCount = 0;
    const from = jest.fn((table: string) => {
      if (table === 'cart_items') return cartItems;
      cartQueryCount += 1;
      return cartQueryCount === 1 ? activeCart : createdCart;
    });
    const user = { id: 'user-8', email: 'buyer@example.com' };
    (createClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) }, from });

    const result = await getActiveCart();

    expect(from).toHaveBeenCalledWith('carts');
    expect(from).toHaveBeenCalledWith('cart_items');
    expect(result.user).toEqual(user);
    expect(result.cartId).toBe(8);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].product.name).toBe('Mug');
  });

  it('returns the signed-in user with no cart when cart creation fails', async () => {
    const activeCart = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const cartInsert = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert denied' } }),
    };
    let cartQueryCount = 0;
    const from = jest.fn((table: string) => {
      if (table !== 'carts') throw new Error('cart lines should not load without a cart');
      cartQueryCount += 1;
      return cartQueryCount === 1 ? activeCart : cartInsert;
    });
    const user = { id: 'user-8', email: 'buyer@example.com' };
    (createClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) }, from });

    await expect(getActiveCart()).resolves.toEqual({ user, cartId: null, lines: [] });
  });

  it('returns an empty line list when the cart-items query has no data', async () => {
    const activeCart = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 11 }, error: null }),
    };
    const cartItems = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: { message: 'query failed' } }),
    };
    const from = jest.fn((table: string) => table === 'carts' ? activeCart : cartItems);
    const user = { id: 'user-11' };
    (createClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) }, from });

    await expect(getActiveCart()).resolves.toEqual({ user, cartId: 11, lines: [] });
  });
});