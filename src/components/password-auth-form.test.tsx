import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PasswordAuthForm from './password-auth-form';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

describe('PasswordAuthForm', () => {
  const replace = jest.fn();
  const refresh = jest.fn();
  const signInWithPassword = jest.fn();
  const signUp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace, refresh });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('next=%2Fcheckout'));
    (createClient as jest.Mock).mockReturnValue({ auth: { signInWithPassword, signUp } });
    signInWithPassword.mockResolvedValue({ error: null });
    signUp.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('rejects mismatched signup passwords without calling Supabase', async () => {
    render(<PasswordAuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Taylor Doe' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'taylor@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Your passwords don't match.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it('signs in with trimmed email and returns to the requested safe path', async () => {
    render(<PasswordAuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' buyer@example.com ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({ email: 'buyer@example.com', password: 'password123' }));
    expect(replace).toHaveBeenCalledWith('/checkout');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows authentication failures to the user', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<PasswordAuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
    expect(replace).not.toHaveBeenCalled();
  });

  it('rejects signup passwords shorter than eight characters', async () => {
    render(<PasswordAuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'short' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('creates an account and redirects immediately when signup returns a session', async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: 'test-session' } }, error: null });
    render(<PasswordAuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: ' Taylor Doe ' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' buyer@example.com ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'buyer@example.com',
      password: 'password123',
      options: expect.objectContaining({ data: { full_name: 'Taylor Doe' } }),
    })));
    expect(replace).toHaveBeenCalledWith('/checkout');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows a confirmation message when email confirmation is required', async () => {
    render(<PasswordAuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Taylor Doe' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Check your email for a confirmation link');
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ emailRedirectTo: expect.stringContaining('/auth/callback?next=%2Fcheckout') }) }));
  });

  it('surfaces signup failures and callback-link errors', async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: { message: 'Signup is disabled' } });
    const { unmount } = render(<PasswordAuthForm mode="signup" />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Taylor Doe' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Signup is disabled');

    unmount();
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('error=auth_callback'));
    render(<PasswordAuthForm mode="login" />);
    expect(screen.getByRole('alert')).toHaveTextContent('confirmation link');
  });
});