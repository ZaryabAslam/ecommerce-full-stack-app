import { fireEvent, render, screen } from '@testing-library/react';
import CheckoutContent from './checkout-content';
import type { CartLine } from '@/lib/types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

jest.mock('./checkout-form', () => ({
  __esModule: true,
  default: ({ onShippingMethodChange, cancelled }: { onShippingMethodChange: (method: 'standard' | 'expedited') => void; cancelled: boolean }) => (
    <div>
      {cancelled && <p>Checkout cancelled</p>}
      <button onClick={() => onShippingMethodChange('expedited')}>Choose expedited</button>
    </div>
  ),
}));

const line: CartLine = {
  id: 1,
  cart_id: 2,
  product_id: 3,
  quantity: 2,
  unit_price: 20,
  product: {
    id: 3,
    name: 'Water bottle',
    slug: 'water-bottle',
    description: null,
    sku: 'WB-3',
    price: 20,
    stock_quantity: 8,
    category: 'Lifestyle',
    image_url: null,
    active: true,
  },
};

describe('CheckoutContent', () => {
  it('shows subtotal, free standard shipping for qualifying orders, and total', () => {
    render(<CheckoutContent lines={[line]} subtotal={60} />);
    expect(screen.getByText('Subtotal').nextElementSibling).toHaveTextContent('$60.00');
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Estimated total').nextElementSibling).toHaveTextContent('$60.00');
  });

  it('recalculates the displayed shipping and total when delivery changes', () => {
    render(<CheckoutContent lines={[line]} subtotal={40} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose expedited' }));
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('Estimated total').nextElementSibling).toHaveTextContent('$55.00');
  });

  it('displays the cancelled checkout notice through its form', () => {
    render(<CheckoutContent lines={[line]} subtotal={40} cancelled />);
    expect(screen.getByText('Checkout cancelled')).toBeInTheDocument();
  });
});