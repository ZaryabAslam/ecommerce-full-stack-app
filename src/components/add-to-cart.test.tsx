import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AddToCart from './add-to-cart';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({ useRouter: jest.fn(), useSearchParams: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

describe('AddToCart', () => {
  const push = jest.fn();
  const refresh = jest.fn();
  const replace = jest.fn();
  const get = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    get.mockReturnValue(null);
    (useRouter as jest.Mock).mockReturnValue({ push, refresh, replace });
    (useSearchParams as jest.Mock).mockReturnValue({ get });
  });

  it('sends signed-out customers to login with a resume path', async () => {
    (createClient as jest.Mock).mockReturnValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) } });
    render(<AddToCart productId={12} stock={5} productSlug="desk-lamp" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login?next=%2Fproducts%2Fdesk-lamp%3FaddToCart%3D12'));
  });

  it('adds an available product and navigates to the bag', async () => {
    const cartQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 9 }, error: null }),
    };
    const itemsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn((table: string) => table === 'carts' ? cartQuery : itemsQuery),
    });
    render(<AddToCart productId={12} stock={5} productSlug="desk-lamp" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Added to your bag');
    expect(itemsQuery.insert).toHaveBeenCalledWith({ cart_id: 9, product_id: 12, quantity: 1 });
    expect(push).toHaveBeenCalledWith('/cart');
    expect(refresh).toHaveBeenCalled();
  });

  it('automatically resumes adding the requested product after sign-in', async () => {
    get.mockReturnValue('12');
    const cartQuery = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: 9 }, error: null }),
    };
    const itemQuery = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn((table: string) => table === 'carts' ? cartQuery : itemQuery),
    });
    render(<AddToCart productId={12} stock={5} productSlug="desk-lamp" />);

    expect(await screen.findByRole('status')).toHaveTextContent('Added to your bag');
    expect(replace).toHaveBeenCalledWith('/products/desk-lamp', { scroll: false });
    expect(itemQuery.insert).toHaveBeenCalledWith({ cart_id: 9, product_id: 12, quantity: 1 });
  });

  it('creates a cart and caps an existing item at available stock', async () => {
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
      single: jest.fn().mockResolvedValue({ data: { id: 19 }, error: null }),
    };
    const itemQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 8, quantity: 9 }, error: null }),
      update: jest.fn().mockReturnThis(),
    };
    itemQuery.eq.mockImplementation((column: string) => column === 'id' ? Promise.resolve({ error: null }) : itemQuery);
    let cartCalls = 0;
    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn((table: string) => {
        if (table === 'cart_items') return itemQuery;
        cartCalls += 1;
        return cartCalls === 1 ? activeCart : cartInsert;
      }),
    });
    render(<AddToCart productId={12} stock={5} productSlug="desk-lamp" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Added to your bag');
    expect(itemQuery.update).toHaveBeenCalledWith({ quantity: 5 });
    expect(push).toHaveBeenCalledWith('/cart');
  });

  it('reports cart creation and cart-item lookup failures', async () => {
    const activeCart = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const failedInsert = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }),
    };
    let cartCalls = 0;
    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn((table: string) => {
        if (table === 'cart_items') throw new Error('lookup should not run');
        cartCalls += 1;
        return cartCalls === 1 ? activeCart : failedInsert;
      }),
    });
    const { rerender } = render(<AddToCart productId={12} stock={5} productSlug="desk-lamp" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not open your cart');

    const lookupQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'cart lookup failed' } }),
    };
    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn((table: string) => table === 'carts'
        ? { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: 9 }, error: null }) }
        : lookupQuery),
    });
    rerender(<AddToCart productId={13} stock={5} productSlug="desk-lamp" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(await screen.findByRole('status')).toHaveTextContent('cart lookup failed');
    expect(push).not.toHaveBeenCalled();
  });

  it('reports when cart creation returns no cart and no database error', async () => {
    const activeCart = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insertCart = {
      insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    let cartCalls = 0;
    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn(() => ++cartCalls === 1 ? activeCart : insertCart),
    });
    render(<AddToCart productId={12} stock={5} productSlug="desk-lamp" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Could not open your cart');
  });

  it('shows a database error when updating an existing cart item fails', async () => {
    const cartQuery = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: 9 }, error: null }),
    };
    const itemQuery = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 6, quantity: 1 }, error: null }),
      update: jest.fn().mockReturnThis(),
    };
    itemQuery.eq.mockImplementation((column: string) => column === 'id' ? Promise.resolve({ error: { message: 'stock update denied' } }) : itemQuery);
    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn((table: string) => table === 'carts' ? cartQuery : itemQuery),
    });
    render(<AddToCart productId={12} stock={5} productSlug="desk-lamp" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));

    expect(await screen.findByRole('status')).toHaveTextContent('stock update denied');
    expect(push).not.toHaveBeenCalled();
  });

  it('disables adding when the product is out of stock', () => {
    render(<AddToCart productId={12} stock={0} productSlug="desk-lamp" />);
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  });
});