import { getProduct, getProducts } from './data';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

describe('product data queries', () => {
  let query: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    let queryResult: { data: unknown; error: unknown } = { data: null, error: null };
    query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      then: jest.fn((resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(queryResult).then(resolve, reject)),
    };
    Object.defineProperty(query, 'setResult', { value: (result: { data: unknown; error: unknown }) => { queryResult = result; } });
    (createClient as jest.Mock).mockResolvedValue({ from: jest.fn().mockReturnValue(query) });
  });

  it('loads active products in order', async () => {
    const products = [{ id: 1, name: 'Lamp', active: true }];
    (query as typeof query & { setResult: (result: { data: unknown; error: unknown }) => void }).setResult({ data: products, error: null });

    await expect(getProducts()).resolves.toEqual(products);
    expect(query.eq).toHaveBeenCalledWith('active', true);
    expect(query.order).toHaveBeenCalledWith('id');
    expect(query.ilike).not.toHaveBeenCalled();
  });

  it('applies category filtering and returns an empty list on query errors', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    query.ilike.mockReturnThis();
    (query as typeof query & { setResult: (result: { data: unknown; error: unknown }) => void }).setResult({ data: null, error: { message: 'database unavailable' } });

    await expect(getProducts('Home')).resolves.toEqual([]);
    expect(query.ilike).toHaveBeenCalledWith('category', 'Home');
    expect(log).toHaveBeenCalledWith('Unable to load products', 'database unavailable');
    log.mockRestore();
  });

  it('loads one active product by slug and returns null when it does not exist', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getProduct('missing-item')).resolves.toBeNull();
    expect(query.eq).toHaveBeenNthCalledWith(1, 'slug', 'missing-item');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'active', true);
  });
});