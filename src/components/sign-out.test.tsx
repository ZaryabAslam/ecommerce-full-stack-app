import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SignOut from './sign-out';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

describe('SignOut', () => {
  it('signs out and returns to the home page', async () => {
    const push = jest.fn();
    const refresh = jest.fn();
    const signOut = jest.fn().mockResolvedValue({ error: null });
    (useRouter as jest.Mock).mockReturnValue({ push, refresh });
    (createClient as jest.Mock).mockReturnValue({ auth: { signOut } });
    render(<SignOut />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith('/');
    expect(refresh).toHaveBeenCalled();
  });
});