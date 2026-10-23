import { render, screen } from '@testing-library/react';
import Header from './header';
import { createClient } from '@/lib/supabase/server';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

describe('Header', () => {
  it.each([
    [null, 'Sign in', '/login'],
    [{ id: 'user-1' }, 'Account', '/account'],
  ])('shows the correct account action for the current user', async (user, label, href) => {
    (createClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) } });

    render(await Header());

    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', href);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bag' })).toHaveAttribute('href', '/cart');
  });
});