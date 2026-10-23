import { render, screen } from '@testing-library/react';
import NotFound from './not-found';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

it('shows a not-found message and a route back to shopping', () => {
  render(<NotFound />);

  expect(screen.getByRole('heading', { name: 'This page took a little detour.' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to shopping' })).toHaveAttribute('href', '/products');
});