# Avantis Trader SDK

A comprehensive TypeScript SDK for interacting with the Avantis decentralized leveraged trading platform on Base network.

## Features

- 🔐 **Multiple Signer Support**: Local wallet and AWS KMS signers
- 📊 **Trading Operations**: Open, close, and manage leveraged positions
- 🤝 **Delegation**: Allow other addresses to trade on your behalf
- 🎁 **Referral System**: Set and manage referral codes for fee discounts
- 📈 **Market Data**: Real-time price feeds via WebSocket
- 🔍 **Advanced Queries**: Price impact, fees, liquidity depth calculations
- ⚡ **Multicall**: Batch multiple contract calls for efficiency
- 🛡️ **Type Safety**: Full TypeScript support with Zod validation

## Installation

```bash
npm install avantis-trader-sdk
```

## Quick Start

```typescript
import { TraderClient, TradeInputOrderType } from 'avantis-trader-sdk';

// Initialize client
const client = new TraderClient('https://mainnet.base.org');

// Set signer
client.setLocalSigner('your-private-key');

// Open a trade
const trade = {
  trader: await client.signer.getAddress(),
  pairIndex: 0, // BTC/USD
  index: 0,
  initialPosToken: 100, // 100 USDC collateral
  positionSizeUSDC: 100,
  openPrice: 50000,
  buy: true, // Long position
  leverage: 10, // 10x leverage
  tp: 55000, // Take profit
  sl: 48000, // Stop loss
};

const receipt = await client.tradingOps.openTrade(
  trade,
  TradeInputOrderType.MARKET,
  1 // 1% slippage
);
```

## Contract Addresses (Base Mainnet)

The SDK is pre-configured with the following contract addresses:

- **TradingStorage**: `0x8a311D7048c35985aa31C131B9A13e03a5f7422d`
- **PairStorage**: `0x5db3772136e5557EFE028Db05EE95C84D76faEC4`
- **PairInfos**: `0x81F22d0Cc22977c91bEfE648C9fddf1f2bd977e5`
- **PriceAggregator**: `0x64e2625621970F8cfA17B294670d61CB883dA511`
- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Trading**: `0x44914408af82bC9983bbb330e3578E1105e11d4e`
- **Multicall**: `0xb7125506Ff25211c4C51DFD8DdED00BE6Fa8Cbf7`
- **Referral**: `0x1A110bBA13A1f16cCa4b79758BD39290f29De82D`

## Core Modules

### Trading Operations

Execute trades and manage positions:

```typescript
// Open trade
await client.tradingOps.openTrade(trade, orderType, slippage);

// Close trade
await client.tradingOps.closeTradeMarket(pairIndex, tradeIndex, amount);

// Update TP/SL
await client.tradingOps.updateTpAndSl(pairIndex, tradeIndex, newSl, newTp);

// Update margin
await client.tradingOps.updateMargin(pairIndex, tradeIndex, updateType, amount);

// Cancel limit order
await client.tradingOps.cancelOpenLimitOrder(pairIndex, orderIndex);

// Query trades
const trade = await client.tradingOps.getOpenTrade(trader, pairIndex, index);
const count = await client.tradingOps.getOpenTradesCount(trader, pairIndex);
```

### Delegation

Allow trusted addresses to trade on your behalf:

```typescript
// Set delegate
await client.delegation.setDelegate(delegateAddress);

// Check delegate
const delegate = await client.delegation.getDelegateFor(ownerAddress);

// Execute delegated action
const callData = client.delegation.encodeUpdateTpAndSl(...);
await client.delegation.delegatedAction(traderAddress, callData, value);

// Remove delegate
await client.delegation.removeDelegate();
```

### Referral System

Manage referral codes and earn fee discounts:

```typescript
// Set referral code
await client.referral.setReferralCode('MYCODE');

// Get referral info
const info = await client.referral.getTraderReferralInfo(address);

// Get tier info
const tier = await client.referral.getReferrerTier(address);
const tierInfo = await client.referral.getTierInfo(tier);

// Calculate discount
const discount = await client.referral.getTraderReferralDiscount(address, fee);
```

### Pair Info Queries

Get detailed market information:

```typescript
// Price impact and spread
const impact = await client.pairInfoQueries.getPriceImpactSpread(pairIndex, isLong, size, isOpen);
const skew = await client.pairInfoQueries.getSkewImpactSpread(pairIndex, isLong, size, isOpen);

// Fees
const feeUsdc = await client.pairInfoQueries.getOpenFeeUsdc(pairIndex, size, isLong);
const feeP = await client.pairInfoQueries.getOpenFeeP(pairIndex, size, isLong);

// Loss protection
const tier = await client.pairInfoQueries.getLossProtectionTierForSize(pairIndex, size);
const protection = await client.pairInfoQueries.getLossProtectionP(pairIndex, tier);

// Liquidity depth
const depth = await client.pairInfoQueries.getDepth(pairIndex);
```

### Multicall

Batch multiple queries efficiently:

```typescript
// Batch read trades
const trades = await client.multicall.batchGetOpenTrades(
  tradingStorage,
  trader,
  pairIndex,
  [0, 1, 2]
);

// Batch read pair info
const pairs = await client.multicall.batchGetPairs(pairStorage, [0, 1, 2, 3]);

// Custom multicall
const result = await client.multicall.aggregateAndDecode([
  { contract: pairInfos, functionName: 'onePercentDepthAboveUsdc', args: [0] },
  { contract: tradingStorage, functionName: 'openInterestUsdc', args: [0, 0] },
]);
```

## Decimal Precision

The SDK handles different decimal precisions:

- **USDC amounts**: 6 decimals
- **Prices**: 10 decimals
- **Percentages/Leverage**: 10 decimals
- **Fees**: 12 decimals
- **ETH/Execution fees**: 18 decimals

Helper functions:
```typescript
import { toBlockchain6, fromBlockchain6, toBlockchain10, fromBlockchain10 } from 'avantis-trader-sdk';

// Convert to blockchain format
const usdcAmount = toBlockchain6(100); // 100 USDC -> 100000000
const price = toBlockchain10(50000); // $50,000 -> 500000000000000

// Convert from blockchain format
const usdc = fromBlockchain6(100000000); // -> 100
const priceNum = fromBlockchain10(500000000000000); // -> 50000
```

## Optimized Snapshot

The SDK includes an optimized snapshot implementation that uses `getPairBackend()` to reduce contract calls:

```typescript
// Get optimized market snapshot
const snapshot = await client.snapshotRPC.getSnapshot();

// Get full backend data for advanced use cases
const fullData = await client.snapshotRPC.getPairFullData(0);
const allData = await client.snapshotRPC.getAllPairsFullData();
```

**Benefits:**
- 40% fewer RPC calls by consolidating static config data
- Complete pair configuration in single call
- Better caching opportunities for static vs dynamic data
- Access to detailed fee structures, leverage limits, and group configs

See `OPTIMIZATION_GUIDE.md` for detailed information.

## Examples

Check the `examples/` directory for complete examples:

- `trading-operations.ts` - Opening, closing, and managing trades
- `delegation-and-referrals.ts` - Delegation and referral functionality
- `advanced-queries.ts` - Market data queries and multicall
- `optimized-snapshot.ts` - Efficient market data fetching
- `basic-usage.ts` - Basic SDK usage
- `kms-signer.ts` - AWS KMS integration
- `price-feed.ts` - Real-time price feeds

## Error Handling

All contract interactions may throw errors. Always wrap in try-catch:

```typescript
try {
  const receipt = await client.tradingOps.openTrade(...);
  console.log('Success:', receipt.hash);
} catch (error) {
  console.error('Trade failed:', error.message);
}
```

## License

MIT