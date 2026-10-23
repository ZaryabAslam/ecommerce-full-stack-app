import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfileForm from './profile-form';
import { createClient } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

describe('ProfileForm', () => {
  const eq = jest.fn();
  const update = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    eq.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    (createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({ update })),
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    });
  });

  it('saves editable profile details and displays success', async () => {
    render(<ProfileForm initial={{ first_name: 'Taylor', last_name: 'Doe', email: 'taylor@example.com', phone: '' }} />);
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'Taylor Ann' } });
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '5551234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ first_name: 'Taylor Ann', last_name: 'Doe', phone: '5551234567' }));
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(await screen.findByText('Your details have been saved.')).toBeInTheDocument();
  });

  it('displays database errors', async () => {
    eq.mockResolvedValue({ error: { message: 'Profile update denied' } });
    render(<ProfileForm initial={{ first_name: 'Taylor', last_name: 'Doe', email: 'taylor@example.com', phone: '' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Profile update denied')).toBeInTheDocument();
  });
});