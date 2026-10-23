import { money, safeNextPath } from './utils';

describe('money', () => {
  it('formats numbers and numeric strings as USD', () => {
    expect(money(1234.5)).toBe('$1,234.50');
    expect(money('9')).toBe('$9.00');
  });

  it('treats empty values as zero', () => {
    expect(money('')).toBe('$0.00');
  });
});

describe('safeNextPath', () => {
  it('accepts an internal absolute path', () => {
    expect(safeNextPath('/account/orders')).toBe('/account/orders');
  });

  it.each([null, '', 'https://example.com', '//example.com', 'account'])('uses the fallback for unsafe path %s', (path) => {
    expect(safeNextPath(path)).toBe('/account');
  });

  it('supports a caller-provided fallback', () => {
    expect(safeNextPath(null, '/cart')).toBe('/cart');
  });
});