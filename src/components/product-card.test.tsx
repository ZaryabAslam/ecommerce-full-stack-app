import { render, screen } from '@testing-library/react';
import ProductCard from './product-card';
import type { Product } from '@/lib/types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

const product: Product = {
  id: 5,
  name: 'Desk lamp',
  slug: 'desk-lamp',
  description: 'A bright little lamp',
  sku: 'LAMP-5',
  price: '24.50',
  stock_quantity: 4,
  category: 'Home',
  image_url: null,
  active: true,
};

describe('ProductCard', () => {
  it('shows product details, formatted price, fallback art, and product link', () => {
    render(<ProductCard product={product} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/desk-lamp');
    expect(screen.getByRole('heading', { name: 'Desk lamp' })).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('$24.50')).toBeInTheDocument();
    expect(screen.getByText('BC')).toBeInTheDocument();
  });

  it('renders the product image when one is available', () => {
    render(<ProductCard product={{ ...product, image_url: '/lamp.png' }} />);
    expect(screen.getByRole('img', { name: 'Desk lamp' })).toHaveAttribute('src', '/lamp.png');
  });

  it('uses the default category label when the product has no category', () => {
    render(<ProductCard product={{ ...product, category: null }} />);
    expect(screen.getByText('Everyday')).toBeInTheDocument();
  });
});