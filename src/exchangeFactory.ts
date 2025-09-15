import ccxt from 'ccxt';
import type { Credentials, ExchangeConfig, ExchangeLike, JsonValue } from './types';

// Options object accepted by ccxt exchange constructors (subset + pass-through)
type CcxtOptions = {
  enableRateLimit?: boolean;
  options?: Record<string, JsonValue>;
  subaccount?: string;

  // common credential fields ccxt recognizes
  apiKey?: string;
  secret?: string;
  password?: string;
  uid?: string;
  login?: string;
  token?: string;
  twofa?: string;

  // allow extra exchange-specific keys without using `any`
} & Record<string, JsonValue>;

type CcxtExchangeCtor = new (opts?: CcxtOptions) => ExchangeLike;
type CcxtRegistry = Record<string, CcxtExchangeCtor>;

export function createExchange(config: ExchangeConfig, credentials?: Credentials): ExchangeLike {
  const { exchange, enable_rate_limit = true, default_type, subaccount } = config;

  // Safely index into the ccxt registry
  const registry = ccxt as unknown as CcxtRegistry;
  const ctor = registry[exchange];
  if (typeof ctor !== 'function') {
    throw new Error(`Unsupported exchange: ${exchange}`);
  }

  const options: CcxtOptions = {
    enableRateLimit: enable_rate_limit,
    options: {},
  };

  if (default_type) {
    options.options = { ...(options.options ?? {}), defaultType: default_type };
  }
  if (subaccount) {
    options.subaccount = subaccount;
  }

  if (credentials) {
    if (credentials.api_key) options.apiKey = credentials.api_key;
    if (credentials.secret) options.secret = credentials.secret;
    if (credentials.password) options.password = credentials.password;
    if (credentials.uid) options.uid = credentials.uid;
    if (credentials.login) options.login = credentials.login;
    if (credentials.token) options.token = credentials.token;
    if (credentials.twofa) options.twofa = credentials.twofa;
  }

  return new ctor(options);
}
