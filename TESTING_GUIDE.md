# Testing Guide for Base Mainnet

This guide will help you test the Avantis SDK on Base Mainnet.

## ⚠️ Important Warnings

- **This is MAINNET** - You'll be using real money!
- Start with small amounts for testing
- Never commit your private key to Git
- Use a test wallet, not your main wallet
- Double-check all contract addresses before executing trades

## Prerequisites

1. **Node.js** installed (v16+)
2. **Base Mainnet RPC URL** (see options below)
3. **Avantis contract addresses** for Base (see where to find them below)
4. **Wallet with funds** (optional, only needed for transactions):
   - ETH for gas fees
   - USDC for trading (if you want to test trading)

## Step 1: Install Dependencies

```bash
# Install main dependencies (already done if you ran npm install)
npm install

# Install dotenv for environment variables
npm install dotenv

# Install ts-node to run TypeScript directly
npm install -D ts-node
```

## Step 2: Get Base Mainnet RPC URL

Choose one of these options:

### Option 1: Public RPC (Free, may have rate limits)
```
https://mainnet.base.org
```

### Option 2: Alchemy (Recommended)
1. Go to https://www.alchemy.com/
2. Create free account
3. Create new app for "Base Mainnet"
4. Copy your HTTP URL: `https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY`

### Option 3: Infura
1. Go to https://www.infura.io/
2. Create free account
3. Create new key for Base
4. Copy URL: `https://base-mainnet.infura.io/v3/YOUR_PROJECT_ID`

### Option 4: QuickNode
1. Go to https://www.quicknode.com/
2. Create endpoint for Base Mainnet

## Step 3: Get Avantis Contract Addresses

You need to find the official Avantis contract addresses deployed on Base Mainnet.

### Where to find them:

1. **Avantis Official Documentation**
   - Visit: https://docs.avantisfi.com/
   - Look for "Contract Addresses" or "Base Deployment" section

2. **Avantis SDK Documentation**
   - Visit: https://sdk.avantisfi.com/
   - Check for Base Mainnet addresses

3. **Avantis GitHub**
   - Check their repositories for deployment addresses

4. **Avantis Discord/Telegram**
   - Ask in their official community channels

5. **Base Explorer**
   - Visit: https://basescan.org/
   - Search for "Avantis" to find their contracts

### Contracts you need:
- `TradingStorage` - Stores trading data
- `PairStorage` - Stores trading pair information
- `PairInfos` - Pair info contract
- `PriceAggregator` - Price aggregation contract
- `Trading` - Main trading contract
- `Referral` - Referral system contract
- `USDC` - Base USDC token (already known: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

## Step 4: Setup Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your values
nano .env  # or use your preferred editor
```

Fill in the `.env` file:

```bash
# Base Mainnet RPC
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Your private key (OPTIONAL - only if you want to make transactions)
# Use a TEST wallet with small amounts!
PRIVATE_KEY=0x...

# Avantis Contract Addresses (get from Avantis docs)
TRADING_STORAGE_ADDRESS=0x...
PAIR_STORAGE_ADDRESS=0x...
PAIR_INFOS_ADDRESS=0x...
PRICE_AGGREGATOR_ADDRESS=0x...
TRADING_ADDRESS=0x...
REFERRAL_ADDRESS=0x...

# These are correct for Base Mainnet
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
MULTICALL_ADDRESS=0xcA11bde05977b3631167028862bE2a173976CA11
```

## Step 5: Run Tests

### Read-Only Test (No wallet needed)

This will fetch market data without needing a wallet:

```bash
# Don't set PRIVATE_KEY in .env
npx ts-node examples/test-base-mainnet.ts
```

This will:
- Fetch market snapshot
- Get all trading pairs
- Display available pairs
- Show market data

### Full Test (With wallet)

**⚠️ WARNING: This will use real money!**

```bash
# Set PRIVATE_KEY in .env
npx ts-node examples/test-base-mainnet.ts
```

This will also:
- Check your USDC balance
- Check USDC allowance
- List your open trades

## Step 6: Build the SDK

To compile the SDK:

```bash
npm run build
```

## Testing Strategy

### Phase 1: Read-Only Testing (Safe)
1. ✅ Test without private key
2. ✅ Fetch market snapshot
3. ✅ Get trading pairs
4. ✅ Check pair data
5. ✅ Verify contract addresses are correct

### Phase 2: Wallet Testing (Use test wallet)
1. ⚠️ Set up test wallet with small ETH amount
2. ⚠️ Check balances
3. ⚠️ Check allowances
4. ⚠️ List open trades

### Phase 3: Small Transaction Testing (Very careful)
1. 🔴 Approve small USDC amount (e.g., 10 USDC)
2. 🔴 Open tiny test position (e.g., $5 with 2x leverage)
3. 🔴 Close test position
4. 🔴 Verify everything works

### Phase 4: Production (Only after thorough testing)
1. Use production wallet
2. Start with small positions
3. Gradually increase size

## Common Issues and Solutions

### Issue: "Cannot find module 'dotenv'"
**Solution**:
```bash
npm install dotenv
```

### Issue: "Cannot find contract addresses"
**Solution**:
- Check that addresses in .env are correct
- Verify addresses at https://docs.avantisfi.com/
- Ensure you're using Base Mainnet addresses (not testnet)

### Issue: "RPC request failed"
**Solution**:
- Check your RPC URL is correct
- Try a different RPC provider
- Check if you've exceeded rate limits

### Issue: "Insufficient funds"
**Solution**:
- Make sure you have ETH for gas fees
- Make sure you have USDC for trading
- Bridge funds to Base using https://bridge.base.org/

### Issue: "Transaction reverted"
**Solution**:
- Check that trading is enabled on Avantis
- Verify your position size meets minimum requirements
- Check if you have sufficient USDC allowance

## Using with TypeScript in Your Project

```typescript
import { TraderClient, setContractAddresses } from 'avantis-trader-sdk';

// Configure contracts
setContractAddresses({
  TradingStorage: '0x...',
  Trading: '0x...',
  // ... other addresses
});

// Initialize client
const client = new TraderClient('https://base-mainnet.g.alchemy.com/v2/YOUR_KEY');

// Set signer
client.setLocalSigner(process.env.PRIVATE_KEY!);

// Use the SDK
const snapshot = await client.snapshotRPC.getSnapshot();
console.log('Market data:', snapshot);
```

## Security Best Practices

1. **Never commit .env file** - It's already in .gitignore
2. **Use separate test wallet** - Don't use your main wallet
3. **Start with small amounts** - Test with minimal funds first
4. **Verify addresses** - Double-check all contract addresses
5. **Review transactions** - Always review before signing
6. **Use hardware wallet** - Consider Ledger/Trezor for production
7. **Monitor gas prices** - Base has low fees but check before large transactions

## Getting Help

- **Avantis Docs**: https://docs.avantisfi.com/
- **SDK Docs**: https://sdk.avantisfi.com/
- **Base Docs**: https://docs.base.org/
- **GitHub Issues**: Open an issue if you find bugs

## Next Steps

After successful testing:

1. Review the examples in `/examples` directory
2. Read through the main README.md for full API documentation
3. Check out the source code in `/src` to understand the implementation
4. Build your trading application using the SDK
5. Join Avantis community for updates and support

---

**Good luck with your testing! 🚀**

Remember: Start small, test thoroughly, and always verify everything on mainnet!
