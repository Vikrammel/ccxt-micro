# ccxt-micro

## Description
ccxt-micro is a TypeScript gRPC microservice that wraps the standardized CCXT exchange APIs. It provides a stable, language-agnostic interface to current and historical market data, account state, and order management for many crypto exchanges, enabling other microservices in your platform to make trading and risk decisions.

## Available APIs
All methods accept a `config` and (optionally) `credentials`. Extra per-exchange options can be passed via `params` (free-form JSON). Responses include either a `data` JSON value (mirroring CCXT outputs) or a typed structure (for OHLCV).

Common request fragments:
- `config.exchange`: string (e.g., "binance", "kraken")
- `config.enable_rate_limit`: boolean
- `config.default_type`: string (e.g., "spot", "future")
- `credentials.api_key`, `credentials.secret`, `credentials.password`, `credentials.uid`, `credentials.login`, `credentials.token`
- `params`: arbitrary JSON (mapped to CCXT params)

Status codes:
- `OK (0)`: success
- `INVALID_ARGUMENT (3)`: malformed inputs
- `UNAUTHENTICATED (16)`: bad API keys/creds
- `PERMISSION_DENIED (7)`: account lacks permission
- `NOT_FOUND (5)`: order/asset not found
- `FAILED_PRECONDITION (9)`: e.g., insufficient funds
- `UNIMPLEMENTED (12)`: method not supported by exchange
- `UNAVAILABLE (14)`: network / DDoS / timeout
- `UNKNOWN (2)`: other errors

### loadMarkets(LoadMarketsRequest) -> GenericResponse
**Params:** `reload?: bool`, `params?: object`  
**Mock output:**
``` { "data": { "loaded": true } } ```

### fetchMarkets(BaseRequest) -> GenericResponse
**Params:** `params?: object`  
**Mock output:**
``` { "data": [ { "symbol": "BTC/USDT" } ] } ```

### fetchCurrencies(BaseRequest) -> GenericResponse
**Mock output:**
``` { "data": { "BTC": {}, "USDT": {} } } ```

### fetchTicker(SymbolRequest) -> GenericResponse
**Params:** `symbol: string`, `params?: object`  
**Mock output:**
``` { "data": { "symbol": "BTC/USDT", "last": 65000 } } ```

### fetchTickers(SymbolsRequest) -> GenericResponse
**Params:** `symbols?: string[]`, `params?: object`  
**Mock output:**
``` { "data": { "BTC/USDT": {"last": 65000}, "ETH/USDT": {"last": 3000} } } ```

### fetchOrderBook(OrderBookRequest) -> GenericResponse
**Params:** `symbol: string`, `limit?: number`, `params?: object`  
**Mock output:**
``` { "data": { "bids": [[65000, 1]], "asks": [[65100, 2]] } } ```

### fetchOHLCV(OHLCVRequest) -> FetchOHLCVResponse
**Params:** `symbol: string`, `timeframe?: string`, `since?: number`, `limit?: number`, `params?: object`  
**Mock output:**
``` { "candles": [ { "timestamp": 1710000000000, "open": 60000, "high": 66000, "low": 59000, "close": 65000, "volume": 120 } ] } ```

### fetchStatus(BaseRequest) -> GenericResponse
**Note:** Not all exchanges support this.  
**Mock output:**
``` { "data": { "status": "ok" } } ```

### fetchTrades(TradesRequest) -> GenericResponse
**Params:** `symbol: string`, `since?: number`, `limit?: number`, `params?: object`  
**Mock output:**
``` { "data": [ { "id": "t1", "price": 65000, "amount": 0.01 } ] } ```

### fetchBalance(BalanceRequest) -> GenericResponse
**Mock output:**
``` { "data": { "total": { "USDT": 1000 } } } ```

### fetchOrder(FetchOrderRequest) -> GenericResponse
**Params:** `id: string`, `symbol?: string`, `params?: object`  
**Mock output:**
``` { "data": { "id": "o1", "status": "open" } } ```

### fetchOrders(FetchOrdersRequest) -> GenericResponse
**Params:** `symbol?: string`, `since?: number`, `limit?: number`, `params?: object`  
**Mock output:**
``` { "data": [ { "id": "o1" }, { "id": "o2" } ] } ```

### fetchOpenOrders(FetchOrdersRequest) -> GenericResponse
**Mock output:**
``` { "data": [ { "id": "o1", "status": "open" } ] } ```

### fetchClosedOrders(FetchOrdersRequest) -> GenericResponse
**Mock output:**
``` { "data": [ { "id": "o3", "status": "closed" } ] } ```

### fetchMyTrades(FetchOrdersRequest) -> GenericResponse
**Mock output:**
``` { "data": [ { "id": "mt1", "symbol": "BTC/USDT" } ] } ```

### createOrder(CreateOrderRequest) -> GenericResponse
**Params:** `symbol: string`, `type: string`, `side: string`, `amount: number`, `price?: number`, `params?: object`  
**Mock output:**
``` { "data": { "id": "newOrder" } } ```

### cancelOrder(CancelOrderRequest) -> GenericResponse
**Params:** `id: string`, `symbol?: string`, `params?: object`  
**Mock output:**
``` { "data": { "id": "o1", "status": "canceled" } } ```

### deposit(DepositRequest) -> GenericResponse
**Params:** `code: string`, `amount: number`, `address: string`, `tag?: string`, `params?: object`  
**Note:** Many exchanges do not implement `deposit`; expect `UNIMPLEMENTED (12)` in such cases.  
**Mock output (if supported):**
``` { "data": { "id": "d1", "status": "ok" } } ```

### withdraw(WithdrawRequest) -> GenericResponse
**Params:** `code: string`, `amount: number`, `address: string`, `tag?: string`, `params?: object`  
**Mock output:**
``` { "data": { "id": "w1", "status": "ok" } } ```

## Build and Test

### Local (Node / Yarn)
1. Install deps:

``` npm install ```

``` yarn ```

2. Build:

``` npm run build ```

``` yarn run build ```

3. Start server (default port 50051):

``` npm start ```

``` yarn start ```

4. Run unit tests:

``` npm test ```

``` yarn test ```

### Docker
1. Build image:
``` docker build -t ccxt-micro:latest . ```
2. Run container:
``` docker run --rm -p 50051:50051 --name ccxt-micro ccxt-micro:latest ```
3. (Optional) Environment port override:
``` docker run --rm -e PORT=6000 -p 6000:6000 ccxt-micro:latest ```

### gRPC Usage Example (Node client sketch)
```js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const def = protoLoader.loadSync('proto/ccxt.proto', { longs: String, defaults: true });
const pb = grpc.loadPackageDefinition(def);

const client = new pb.ccxtmicro.CcxtService('localhost:50051', grpc.credentials.createInsecure());
client.fetchTicker({
  config: { exchange: 'binance', enable_rate_limit: true },
  credentials: { api_key: '...', secret: '...' },
  symbol: 'BTC/USDT'
}, (err, res) => {
  if (err) return console.error(err);
  console.log(res.data);
});
```