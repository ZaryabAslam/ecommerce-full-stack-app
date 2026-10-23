import { render, screen } from '@testing-library/react';
import Footer from './footer';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

describe('Footer', () => {
  it('renders shop, account, delivery, and security links', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'Shop all' })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: 'Order history' })).toHaveAttribute('href', '/account/orders');
    expect(screen.getByText('Free standard shipping over $50')).toBeInTheDocument();
    expect(screen.getByText('Payments handled by Stripe')).toBeInTheDocument();
    expect(screen.getByText(/BrightCart\. All rights reserved\./)).toBeInTheDocument();
  });
});