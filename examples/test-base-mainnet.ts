/**
 * Test script for Base Mainnet
 *
 * IMPORTANT: This will interact with real contracts on mainnet.
 * Use small amounts for testing!
 *
 * Setup:
 * 1. npm install dotenv
 * 2. Copy .env.example to .env
 * 3. Fill in your RPC URL and contract addresses
 * 4. (Optional) Add PRIVATE_KEY for wallet transactions
 * 5. Run: npx ts-node examples/test-base-mainnet.ts
 */

import { TraderClient, setContractAddresses } from '../src';

// Load environment variables (install with: npm install dotenv)
try {
  require('dotenv').config();
} catch {
  console.log('Note: dotenv not installed. Using environment variables directly.\n');
}

async function testBaseMainnet() {
  console.log('========================================');
  console.log('Testing Avantis SDK on Base Mainnet');
  console.log('========================================\n');

  // Step 1: Configure Base Mainnet RPC
  const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  console.log(`Using RPC: ${BASE_RPC_URL}\n`);

  // Step 2: Set Avantis contract addresses for Base
  // TODO: Replace these with actual Avantis contract addresses on Base
  // You can find these at: https://docs.avantisfi.com/
  setContractAddresses({
    TradingStorage: process.env.TRADING_STORAGE_ADDRESS || '0x...', // Replace
    PairStorage: process.env.PAIR_STORAGE_ADDRESS || '0x...',       // Replace
    PairInfos: process.env.PAIR_INFOS_ADDRESS || '0x...',          // Replace
    PriceAggregator: process.env.PRICE_AGGREGATOR_ADDRESS || '0x...', // Replace
    USDC: process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
    Trading: process.env.TRADING_ADDRESS || '0x...',                // Replace
    Multicall: process.env.MULTICALL_ADDRESS || '0xcA11bde05977b3631167028862bE2a173976CA11', // Standard multicall3
    Referral: process.env.REFERRAL_ADDRESS || '0x...',             // Replace
  });

  // Step 3: Initialize client
  const client = new TraderClient(BASE_RPC_URL);

  // Step 4: Set up signer (only if you want to make transactions)
  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey) {
    client.setLocalSigner(privateKey);
    const address = await client.signer?.getAddress();
    console.log(`Trading address: ${address}\n`);
  } else {
    console.log('No private key provided. Running in read-only mode.\n');
  }

  try {
    // Test 1: Get market snapshot (read-only, no wallet needed)
    console.log('Test 1: Fetching market snapshot...');
    const snapshot = await client.snapshotRPC.getSnapshot();
    console.log(`✓ Snapshot fetched successfully`);
    console.log(`  - Total pairs: ${snapshot.groups.reduce((acc: number, g: any) => acc + g.pairs.length, 0)}`);
    console.log(`  - Groups: ${snapshot.groups.length}\n`);

    // Test 2: Get specific pair data
    console.log('Test 2: Fetching BTC/USD pair data...');
    try {
      const btcPair = await client.snapshotRPC.getPairSnapshot('BTC/USD');
      console.log(`✓ BTC/USD data fetched`);
      console.log(`  - Pair Index: ${btcPair.pair.pairIndex}`);
      console.log(`  - Group: ${btcPair.pair.groupIndex}\n`);
    } catch (error) {
      console.log(`⚠ BTC/USD pair not found or different name format\n`);
    }

    // Test 3: Get all trading pairs
    console.log('Test 3: Fetching all trading pairs...');
    const pairs = await client.pairsCache.getPairsInfo();
    console.log(`✓ Found ${pairs.length} trading pairs`);
    console.log('Available pairs:');
    pairs.slice(0, 10).forEach((pair: any) => {
      console.log(`  - ${pair.from}/${pair.to} (index: ${pair.pairIndex})`);
    });
    if (pairs.length > 10) {
      console.log(`  ... and ${pairs.length - 10} more\n`);
    }

    // Test 4: Check wallet balances (requires wallet)
    if (client.signer) {
      console.log('\nTest 4: Checking wallet balances...');
      const address = await client.signer.getAddress();

      // Check USDC balance
      const usdcBalance = await client.getUsdcBalance(address);
      console.log(`✓ USDC Balance: ${usdcBalance} USDC`);

      // Check USDC allowance for trading
      const allowance = await client.getUsdcAllowanceForTrading(address);
      console.log(`✓ USDC Allowance: ${allowance} USDC`);

      // Check open trades
      const trades = await client.tradeRPC.getTrades(address);
      console.log(`✓ Open trades: ${trades.length}\n`);

      if (trades.length > 0) {
        console.log('Your open trades:');
        trades.forEach((trade: any, index: number) => {
          console.log(`  ${index + 1}. ${trade.pairIndex} - ${trade.buy ? 'LONG' : 'SHORT'} - Size: ${trade.positionSizeUsdc} USDC`);
        });
      }
    }

    console.log('\n========================================');
    console.log('✓ All tests completed successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error during testing:');
    console.error(error);
    console.error('\nTroubleshooting:');
    console.error('1. Verify contract addresses are correct for Base Mainnet');
    console.error('2. Check RPC URL is working: ' + BASE_RPC_URL);
    console.error('3. Ensure you have sufficient funds if making transactions');
    console.error('4. Visit https://docs.avantisfi.com/ for official contract addresses\n');
    process.exit(1);
  }
}

// Run the tests
testBaseMainnet().catch(console.error);
