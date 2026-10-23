import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CheckoutForm from './checkout-form';

describe('CheckoutForm', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the cancelled notice and allows choosing a shipping method', () => {
    const onShippingMethodChange = jest.fn();
    render(<CheckoutForm cancelled onShippingMethodChange={onShippingMethodChange} />);

    expect(screen.getByText(/Your checkout was cancelled/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Expedited delivery/));
    expect(onShippingMethodChange).toHaveBeenCalledWith('expedited');
  });

  it('submits address and shipping method, then reports API errors accessibly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Could not save the Stripe session against the order.' }),
    });
    render(<CheckoutForm />);

    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Taylor Customer' } });
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText(/Address line 1/), { target: { value: '12 Market Street' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Lahore' } });
    fireEvent.change(screen.getByLabelText(/Postal code/), { target: { value: '54000' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to secure payment/ }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/checkout/create-session', expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the Stripe session against the order.');
    expect(screen.getByRole('button', { name: /Continue to secure payment/ })).toBeEnabled();
  });

  it('shows a useful fallback if the checkout request itself fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
    render(<CheckoutForm />);
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Taylor Customer' } });
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText(/Address line 1/), { target: { value: '12 Market Street' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Lahore' } });
    fireEvent.change(screen.getByLabelText(/Postal code/), { target: { value: '54000' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to secure payment/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    expect(screen.getByRole('button', { name: /Continue to secure payment/ })).toBeEnabled();
  });

  it('shows the fallback when the API succeeds without returning a checkout URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<CheckoutForm />);
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Taylor Customer' } });
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText(/Address line 1/), { target: { value: '12 Market Street' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Lahore' } });
    fireEvent.change(screen.getByLabelText(/Postal code/), { target: { value: '54000' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to secure payment/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not start secure checkout.');
  });

  it('uses the generic message for a non-Error request rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValue('network failure');
    render(<CheckoutForm />);
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Taylor Customer' } });
    fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText(/Address line 1/), { target: { value: '12 Market Street' } });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Lahore' } });
    fireEvent.change(screen.getByLabelText(/Postal code/), { target: { value: '54000' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to secure payment/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not start secure checkout.');
  });
});