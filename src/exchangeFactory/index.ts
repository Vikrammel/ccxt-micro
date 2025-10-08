import { createExchange as createReal } from './real';
import { createExchange as createMock } from './mock';
import type { ExchangeConfig, Credentials, ExchangeLike } from '../types';

const useMock = process.env.USE_MOCK_EXCHANGE === 'true';

export function createExchange(config: ExchangeConfig, creds?: Credentials): ExchangeLike {
  const factory = useMock ? createMock : createReal;
  return factory(config, creds);
}
