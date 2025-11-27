import { ethers, JsonRpcProvider, Contract, TransactionReceipt, TransactionRequest } from 'ethers';
import { BaseSigner } from './signers/base';
import { LocalSigner } from './signers/local';
import { KMSSigner } from './signers/kms';
import { FeedClient } from './feed/feed_client';
import { CONTRACTS, getContractAddress } from './config';
import { PairsCache } from './rpc/pairs_cache';
import { AssetParametersRPC } from './rpc/asset_parameters';
import { CategoryParametersRPC } from './rpc/category_parameters';
import { FeeParametersRPC } from './rpc/fee_parameters';
import { TradingParametersRPC } from './rpc/trading_parameters';
import { BlendedRPC } from './rpc/blended';
import { TradeRPC } from './rpc/trade';
import { SnapshotRPC } from './rpc/snapshot';
import { fromBlockchain6 } from './types';

/**
 * Main client for interacting with Avantis trading platform
 */
export class TraderClient {
  public provider: JsonRpcProvider;
  private signer?: BaseSigner;
  public feedClient?: FeedClient;

  // Contracts
  private contracts: Map<string, Contract> = new Map();

  // RPC modules
  public pairsCache: PairsCache;
  public assetParams: AssetParametersRPC;
  public categoryParams: CategoryParametersRPC;
  public feeParams: FeeParametersRPC;
  public tradingParams: TradingParametersRPC;
  public blendedParams: BlendedRPC;
  public tradeRPC: TradeRPC;
  public snapshotRPC: SnapshotRPC;

  /**
   * Create a new TraderClient
   * @param providerUrl - Ethereum RPC endpoint
   * @param signer - Transaction signer (optional)
   * @param feedClient - Feed client for price updates (optional)
   */
  constructor(
    providerUrl: string,
    signer?: BaseSigner,
    feedClient?: FeedClient
  ) {
    this.provider = new JsonRpcProvider(providerUrl);
    this.signer = signer;
    this.feedClient = feedClient;

    // Initialize RPC modules
    this.initializeContracts();
    this.pairsCache = new PairsCache(
      this.provider,
      this.getContract('PairStorage')
    );

    const pairStorage = this.getContract('PairStorage');
    const pairInfos = this.getContract('PairInfos');
    const trading = this.getContract('Trading');
    const tradingStorage = this.getContract('TradingStorage');
    const referral = this.getContract('Referral');

    this.assetParams = new AssetParametersRPC(
      this.provider,
      pairStorage,
      pairInfos,
      this.pairsCache
    );

    this.categoryParams = new CategoryParametersRPC(
      this.provider,
      pairStorage,
      this.pairsCache
    );

    this.feeParams = new FeeParametersRPC(
      this.provider,
      pairInfos,
      this.pairsCache,
      referral
    );

    this.tradingParams = new TradingParametersRPC(
      this.provider,
      pairInfos,
      this.pairsCache
    );

    this.blendedParams = new BlendedRPC(
      this.assetParams,
      this.categoryParams,
      this.pairsCache
    );

    this.tradeRPC = new TradeRPC(
      this.provider,
      trading,
      tradingStorage,
      this.pairsCache
    );

    this.snapshotRPC = new SnapshotRPC(
      this.pairsCache,
      this.assetParams,
      this.categoryParams,
      this.feeParams,
      this.blendedParams
    );
  }

  /**
   * Initialize contract instances
   */
  private initializeContracts(): void {
    // Minimal ABIs - you should replace these with full ABIs
    const erc20ABI = [
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address, address) view returns (uint256)',
      'function approve(address, uint256) returns (bool)',
    ];

    const minimalABI = [
      'function pairs(uint256) view returns (tuple)',
      'function pairsCount() view returns (uint256)',
      'function openInterestUsdc(uint256, uint256) view returns (uint256)',
      'function groupOI(uint256, uint256) view returns (uint256)',
      'function groupCollateral(uint256, bool) view returns (uint256)',
      'function getOpenTrades(address) view returns (tuple[])',
      'function openTrade(tuple, uint256, uint256, address) payable',
      'function closeTradeMarket(uint256, uint256)',
      'function updateMargin(uint256, uint256, uint256, bool)',
      'function updateTpSl(uint256, uint256, uint256, uint256)',
      'function cancelOpenOrder(uint256, uint256)',
      'function getExecutionFee() view returns (uint256)',
      'function getPriceImpactP(uint256, bool, uint256) view returns (uint256)',
      'function getOpenFeeUsdc(uint256, uint256, bool) view returns (uint256)',
      'function getPairMarginFeeP(uint256) view returns (uint256)',
      'function getLossProtectionTier(uint256, uint256) view returns (uint256)',
      'function getLossProtectionP(uint256, uint256) view returns (uint256)',
      'function getReferralRebateP(address, address) view returns (uint256)',
      'function onePercentDepthAboveUsdc(uint256) view returns (uint256)',
      'function onePercentDepthBelowUsdc(uint256) view returns (uint256)',
    ];

    // Initialize contracts with addresses from config
    this.contracts.set(
      'TradingStorage',
      new Contract(CONTRACTS.TradingStorage, minimalABI, this.provider)
    );
    this.contracts.set(
      'PairStorage',
      new Contract(CONTRACTS.PairStorage, minimalABI, this.provider)
    );
    this.contracts.set(
      'PairInfos',
      new Contract(CONTRACTS.PairInfos, minimalABI, this.provider)
    );
    this.contracts.set(
      'PriceAggregator',
      new Contract(CONTRACTS.PriceAggregator, minimalABI, this.provider)
    );
    this.contracts.set(
      'USDC',
      new Contract(CONTRACTS.USDC, erc20ABI, this.provider)
    );
    this.contracts.set(
      'Trading',
      new Contract(CONTRACTS.Trading, minimalABI, this.provider)
    );
    this.contracts.set(
      'Referral',
      new Contract(CONTRACTS.Referral, minimalABI, this.provider)
    );
  }

  /**
   * Get a contract instance
   * @param name - Contract name
   * @returns Contract instance
   */
  private getContract(name: string): Contract {
    const contract = this.contracts.get(name);
    if (!contract) {
      throw new Error(`Contract ${name} not initialized`);
    }
    return contract;
  }

  /**
   * Set signer for transaction signing
   * @param signer - Signer instance
   */
  setSigner(signer: BaseSigner): void {
    this.signer = signer;
  }

  /**
   * Set local signer using private key
   * @param privateKey - Private key
   */
  setLocalSigner(privateKey: string): void {
    this.signer = new LocalSigner(privateKey, this.provider);
  }

  /**
   * Set AWS KMS signer
   * @param kmsKeyId - KMS key ID
   * @param region - AWS region
   */
  setAwsKmsSigner(kmsKeyId: string, region: string = 'us-east-1'): void {
    this.signer = new KMSSigner(kmsKeyId, this.provider, region);
  }

  /**
   * Get native token balance
   * @param address - Address to check
   * @returns Balance in native token
   */
  async getBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  /**
   * Get USDC balance
   * @param address - Address to check
   * @returns USDC balance
   */
  async getUsdcBalance(address: string): Promise<number> {
    const balance = await this.getContract('USDC').balanceOf(address);
    return fromBlockchain6(balance);
  }

  /**
   * Get USDC allowance for trading
   * @param address - Address to check
   * @returns Allowance amount
   */
  async getUsdcAllowanceForTrading(address: string): Promise<number> {
    const tradingAddress = await this.getContract('Trading').getAddress();
    const allowance = await this.getContract('USDC').allowance(address, tradingAddress);
    return fromBlockchain6(allowance);
  }

  /**
   * Approve USDC for trading
   * @param amount - Amount to approve
   * @returns Transaction receipt
   */
  async approveUsdcForTrading(amount: number): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer not set');
    }

    const tradingAddress = await this.getContract('Trading').getAddress();
    const amountWei = BigInt(Math.floor(amount * 1e6));

    const tx: TransactionRequest = {
      to: CONTRACTS.USDC,
      data: this.getContract('USDC').interface.encodeFunctionData('approve', [
        tradingAddress,
        amountWei,
      ]),
    };

    return await this.signAndGetReceipt(tx);
  }

  /**
   * Sign transaction and wait for receipt
   * @param tx - Transaction to sign
   * @returns Transaction receipt
   */
  async signAndGetReceipt(tx: TransactionRequest): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer not set');
    }

    // Fill in missing transaction fields
    const address = await this.signer.getAddress();
    tx.from = address;

    if (!tx.chainId) {
      const network = await this.provider.getNetwork();
      tx.chainId = network.chainId;
    }

    if (tx.nonce === undefined) {
      tx.nonce = await this.provider.getTransactionCount(address);
    }

    if (!tx.gasLimit) {
      tx.gasLimit = await this.provider.estimateGas(tx);
    }

    if (!tx.maxFeePerGas && !tx.gasPrice) {
      const feeData = await this.provider.getFeeData();
      if (feeData.maxFeePerGas) {
        tx.maxFeePerGas = feeData.maxFeePerGas;
        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || feeData.maxFeePerGas;
      } else {
        tx.gasPrice = feeData.gasPrice || undefined;
      }
    }

    // Sign the transaction
    const signedTx = await this.signer.signTransaction(tx);

    // Send the transaction
    const txResponse = await this.provider.broadcastTransaction(signedTx);

    // Wait for confirmation
    return await txResponse.wait();
  }

  /**
   * Estimate gas for a transaction
   * @param tx - Transaction to estimate
   * @returns Estimated gas
   */
  async estimateGas(tx: TransactionRequest): Promise<bigint> {
    return await this.provider.estimateGas(tx);
  }

  /**
   * Get transaction count (nonce)
   * @param address - Address to check
   * @returns Transaction count
   */
  async getTransactionCount(address: string): Promise<number> {
    return await this.provider.getTransactionCount(address);
  }

  /**
   * Get chain ID
   * @returns Chain ID
   */
  async getChainId(): Promise<bigint> {
    const network = await this.provider.getNetwork();
    return network.chainId;
  }
}
