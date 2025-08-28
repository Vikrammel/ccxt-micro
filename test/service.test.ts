/**
 * Unit tests for all gRPC handlers using a mocked exchange factory.
 * We directly invoke the handler methods with fake call/callback.
 */

import { serviceImpl } from '../src/service';

// Mock the exchange factory to return a stubbed exchange for every call.
jest.mock('../src/exchangeFactory', () => {
  const makeExchange = () => ({
    loadMarkets: jest.fn(async (_reload?: boolean, _p?: any) => ({ loaded: true })),
    fetchMarkets: jest.fn(async (_p?: any) => ([{ symbol: 'BTC/USDT' }])),
    fetchCurrencies: jest.fn(async (_p?: any) => ({ BTC: {}, USDT: {} })),
    fetchTicker: jest.fn(async (_s: string, _p?: any) => ({ symbol: 'BTC/USDT', last: 65000 })),
    fetchTickers: jest.fn(async (_ss?: string[], _p?: any) => ({ 'BTC/USDT': { last: 65000 }, 'ETH/USDT': { last: 3000 } })),
    fetchOrderBook: jest.fn(async (_s: string, _l?: number, _p?: any) => ({ bids: [[65000, 1]], asks: [[65100, 2]] })),
    fetchOHLCV: jest.fn(async (_s: string, _tf?: string, _since?: number, _limit?: number, _p?: any) => [
      [1710000000000, 60000, 66000, 59000, 65000, 120]
    ]),
    fetchStatus: jest.fn(async (_p?: any) => ({ status: 'ok' })),
    fetchTrades: jest.fn(async (_s: string, _since?: number, _limit?: number, _p?: any) => ([
      { id: 't1', price: 65000, amount: 0.01 }
    ])),
    fetchBalance: jest.fn(async (_p?: any) => ({ total: { USDT: 1000 } })),
    fetchOrder: jest.fn(async (_id: string, _sym?: string, _p?: any) => ({ id: 'o1', status: 'open' })),
    fetchOrders: jest.fn(async (_sym?: string, _since?: number, _limit?: number, _p?: any) => ([{ id: 'o1' }, { id: 'o2' }])),
    fetchOpenOrders: jest.fn(async (_sym?: string, _since?: number, _limit?: number, _p?: any) => ([{ id: 'o1', status: 'open' }])),
    fetchClosedOrders: jest.fn(async (_sym?: string, _since?: number, _limit?: number, _p?: any) => ([{ id: 'o3', status: 'closed' }])),
    fetchMyTrades: jest.fn(async (_sym?: string, _since?: number, _limit?: number, _p?: any) => ([{ id: 'mt1', symbol: 'BTC/USDT' }])),
    createOrder: jest.fn(async (_sym: string, _type: string, _side: string, _amount: number, _price?: number, _p?: any) => ({ id: 'newOrder' })),
    cancelOrder: jest.fn(async (_id: string, _sym?: string, _p?: any) => ({ id: 'o1', status: 'canceled' })),
    // deposit not supported in this mock (to test UNIMPLEMENTED path)
    withdraw: jest.fn(async (_code: string, _amt: number, _addr: string, _tag?: string, _p?: any) => ({ id: 'w1', status: 'ok' })),
  });

  return {
    createExchange: jest.fn((_config: any, _creds: any) => makeExchange())
  };
});

const base = {
  config: { exchange: 'mockex', enable_rate_limit: true },
  credentials: { api_key: 'k', secret: 's' },
  params: { value: {} }
};

function fakeCb(resolve: (err: any, res: any) => void) {
  return (err: any, res: any) => resolve({ err, res });
}

describe('CcxtServiceImpl', () => {
  test('loadMarkets', async () => {
    const call: any = { request: { ...base, reload: true } };
    const result = await new Promise<any>((r) => serviceImpl.loadMarkets(call, fakeCb(r)));
    expect(result.err).toBeNull();
    expect(result.res.data).toHaveProperty('loaded', true);
  });

  test('fetchMarkets', async () => {
    const call: any = { request: base };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchMarkets(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(Array.isArray(res.data)).toBe(true);
  });

  test('fetchCurrencies', async () => {
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchCurrencies({ request: base } as any, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data).toHaveProperty('BTC');
  });

  test('fetchTicker', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT' } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchTicker(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data.symbol).toBe('BTC/USDT');
  });

  test('fetchTickers', async () => {
    const call: any = { request: { ...base, symbols: ['BTC/USDT', 'ETH/USDT'] } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchTickers(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data['BTC/USDT'].last).toBe(65000);
  });

  test('fetchOrderBook', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT', limit: 10 } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchOrderBook(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data).toHaveProperty('bids');
  });

  test('fetchOHLCV', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT', timeframe: '1h', since: 0, limit: 1 } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchOHLCV(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.candles[0]).toHaveProperty('timestamp');
    expect(res.candles[0]).toHaveProperty('open');
  });

  test('fetchStatus (unimplemented path handled)', async () => {
    // Our mock exchange implements fetchStatus; verify success path
    const call: any = { request: base };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchStatus(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data.status).toBe('ok');
  });

  test('fetchTrades', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT', since: 0, limit: 1 } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchTrades(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(Array.isArray(res.data)).toBe(true);
  });

  test('fetchBalance', async () => {
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchBalance({ request: base } as any, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data.total.USDT).toBe(1000);
  });

  test('fetchOrder', async () => {
    const call: any = { request: { ...base, id: 'o1', symbol: 'BTC/USDT' } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchOrder(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data.id).toBe('o1');
  });

  test('fetchOrders', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT', since: 0, limit: 10 } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchOrders(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data.length).toBe(2);
  });

  test('fetchOpenOrders', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT' } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchOpenOrders(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data[0].status).toBe('open');
  });

  test('fetchClosedOrders', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT' } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchClosedOrders(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data[0].status).toBe('closed');
  });

  test('fetchMyTrades', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT' } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.fetchMyTrades(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data[0].id).toBe('mt1');
  });

  test('createOrder', async () => {
    const call: any = { request: { ...base, symbol: 'BTC/USDT', type: 'limit', side: 'buy', amount: 1, price: 1 } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.createOrder(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data.id).toBe('newOrder');
  });

  test('cancelOrder', async () => {
    const call: any = { request: { ...base, id: 'o1', symbol: 'BTC/USDT' } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.cancelOrder(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data.status).toBe('canceled');
  });

  test('deposit (unimplemented -> UNIMPLEMENTED)', async () => {
    const call: any = { request: { ...base, code: 'USDT', amount: 1, address: 'addr' } };
    const { err } = await new Promise<any>((r) => serviceImpl.deposit(call, fakeCb(r)));
    expect(err).not.toBeNull();
    expect(err.code).toBe(12); // status.UNIMPLEMENTED
  });

  test('withdraw', async () => {
    const call: any = { request: { ...base, code: 'USDT', amount: 1, address: 'addr' } };
    const { err, res } = await new Promise<any>((r) => serviceImpl.withdraw(call, fakeCb(r)));
    expect(err).toBeNull();
    expect(res.data.id).toBe('w1');
  });
});
