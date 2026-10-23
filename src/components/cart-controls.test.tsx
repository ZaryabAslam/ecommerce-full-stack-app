import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CartControls from './cart-controls';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

describe('CartControls', () => {
  const refresh = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  let query: { eq: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    query = { eq: jest.fn().mockReturnThis() };
    update.mockReturnValue(query);
    remove.mockReturnValue(query);
    (useRouter as jest.Mock).mockReturnValue({ refresh });
    (createClient as jest.Mock).mockReturnValue({ from: jest.fn(() => ({ update, delete: remove })) });
  });

  it('increases quantity without exceeding available stock', async () => {
    query.eq.mockResolvedValue({ error: null });
    render(<CartControls itemId={6} quantity={2} stock={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ quantity: 3 }));
    expect(query.eq).toHaveBeenCalledWith('id', 6);
    expect(refresh).toHaveBeenCalled();
  });

  it('removes an item when decreasing from quantity one', async () => {
    query.eq.mockResolvedValue({ error: null });
    render(<CartControls itemId={6} quantity={1} stock={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));

    await waitFor(() => expect(remove).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it('disables increasing at the stock limit', () => {
    render(<CartControls itemId={6} quantity={3} stock={3} />);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('alerts the user when an item quantity update fails', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    query.eq.mockResolvedValue({ error: { message: 'Quantity update denied' } });
    render(<CartControls itemId={6} quantity={1} stock={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Quantity update denied'));
    alert.mockRestore();
  });
});