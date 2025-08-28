import ccxt from 'ccxt';
import { Credentials, ExchangeConfig, ExchangeLike, Params } from './types';

export function createExchange(config: ExchangeConfig, credentials?: Credentials): ExchangeLike {
  const { exchange, enable_rate_limit = true, default_type, subaccount } = config;
  const ctor = (ccxt as any)[exchange];
  if (!ctor) {
    throw new Error(`Unsupported exchange: ${exchange}`);
  }
  const options: Params = {
    enableRateLimit: enable_rate_limit,
    options: {}
  };

  if (default_type) {
    options.options.defaultType = default_type;
  }
  if (subaccount) {
    options.subaccount = subaccount; // exchange-specific
  }
  if (credentials) {
    if (credentials.api_key) (options as any).apiKey = credentials.api_key;
    if (credentials.secret) (options as any).secret = credentials.secret;
    if (credentials.password) (options as any).password = credentials.password;
    if (credentials.uid) (options as any).uid = credentials.uid;
    if (credentials.login) (options as any).login = credentials.login;
    if (credentials.token) (options as any).token = credentials.token;
  }

  return new ctor(options) as ExchangeLike;
}
