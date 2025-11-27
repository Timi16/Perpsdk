import { Contract, Provider, TransactionRequest } from 'ethers';
import {
  TradeInput,
  TradeResponse,
  MarginUpdateType,
  toBlockchain6,
  toBlockchain10,
  fromBlockchain6,
  fromBlockchain10,
} from '../types';
import { PairsCache } from './pairs_cache';

/**
 * RPC module for trading operations
 */
export class TradeRPC {
  private provider: Provider;
  private tradingContract: Contract;
  private tradingStorageContract: Contract;
  private pairsCache: PairsCache;

  constructor(
    provider: Provider,
    tradingContract: Contract,
    tradingStorageContract: Contract,
    pairsCache: PairsCache
  ) {
    this.provider = provider;
    this.tradingContract = tradingContract;
    this.tradingStorageContract = tradingStorageContract;
    this.pairsCache = pairsCache;
  }

  /**
   * Build transaction to open a trade
   * @param tradeInput - Trade input parameters
   * @returns Transaction request
   */
  async buildTradeOpenTx(tradeInput: TradeInput): Promise<TransactionRequest> {
    const pairIndex = await this.pairsCache.getPairIndex(tradeInput.pair);
    if (pairIndex === undefined) {
      throw new Error(`Pair ${tradeInput.pair} not found`);
    }

    // Convert to blockchain format
    const trade = {
      trader: '', // Will be filled by signer
      pairIndex: pairIndex,
      index: 0,
      initialPosToken: 0,
      positionSizeUsdc: toBlockchain6(tradeInput.collateralInTrade * tradeInput.leverage),
      openPrice: toBlockchain10(tradeInput.openPrice),
      buy: tradeInput.isLong,
      leverage: toBlockchain10(tradeInput.leverage),
      tp: toBlockchain10(tradeInput.tp),
      sl: toBlockchain10(tradeInput.sl),
    };

    const orderType = this.getOrderTypeValue(tradeInput.orderType);
    const slippageP = toBlockchain10(tradeInput.maxSlippageP);
    const executionFee = await this.getTradeExecutionFee();

    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('openTrade', [
        trade,
        orderType,
        slippageP,
        tradeInput.referrer || '0x0000000000000000000000000000000000000000',
      ]),
      value: executionFee,
    };
  }

  /**
   * Build transaction to open a trade via delegation
   * @param tradeInput - Trade input parameters
   * @param trader - Trader address
   * @returns Transaction request
   */
  async buildTradeOpenTxDelegate(
    tradeInput: TradeInput,
    trader: string
  ): Promise<TransactionRequest> {
    const tx = await this.buildTradeOpenTx(tradeInput);
    // Add delegation logic if needed
    return tx;
  }

  /**
   * Build transaction to close a trade
   * @param pairIndex - Pair index
   * @param tradeIndex - Trade index
   * @returns Transaction request
   */
  async buildTradeCloseTx(
    pairIndex: number,
    tradeIndex: number
  ): Promise<TransactionRequest> {
    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('closeTradeMarket', [
        pairIndex,
        tradeIndex,
      ]),
    };
  }

  /**
   * Build transaction to close a trade via delegation
   * @param pairIndex - Pair index
   * @param tradeIndex - Trade index
   * @param trader - Trader address
   * @returns Transaction request
   */
  async buildTradeCloseTxDelegate(
    pairIndex: number,
    tradeIndex: number,
    trader: string
  ): Promise<TransactionRequest> {
    const tx = await this.buildTradeCloseTx(pairIndex, tradeIndex);
    // Add delegation logic if needed
    return tx;
  }

  /**
   * Build transaction to cancel a pending order
   * @param pairIndex - Pair index
   * @param orderIndex - Order index
   * @returns Transaction request
   */
  async buildOrderCancelTx(
    pairIndex: number,
    orderIndex: number
  ): Promise<TransactionRequest> {
    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('cancelOpenOrder', [
        pairIndex,
        orderIndex,
      ]),
    };
  }

  /**
   * Build transaction to update trade margin
   * @param pairIndex - Pair index
   * @param tradeIndex - Trade index
   * @param marginDelta - Margin change amount (USDC)
   * @param updateType - Deposit or withdraw
   * @returns Transaction request
   */
  async buildTradeMarginUpdateTx(
    pairIndex: number,
    tradeIndex: number,
    marginDelta: number,
    updateType: MarginUpdateType
  ): Promise<TransactionRequest> {
    const isDeposit = updateType === MarginUpdateType.DEPOSIT;

    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('updateMargin', [
        pairIndex,
        tradeIndex,
        toBlockchain6(marginDelta),
        isDeposit,
      ]),
    };
  }

  /**
   * Build transaction to update take profit and stop loss
   * @param pairIndex - Pair index
   * @param tradeIndex - Trade index
   * @param tp - Take profit price
   * @param sl - Stop loss price
   * @returns Transaction request
   */
  async buildTradeTpSlUpdateTx(
    pairIndex: number,
    tradeIndex: number,
    tp: number,
    sl: number
  ): Promise<TransactionRequest> {
    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('updateTpSl', [
        pairIndex,
        tradeIndex,
        toBlockchain10(tp),
        toBlockchain10(sl),
      ]),
    };
  }

  /**
   * Get trade execution fee
   * @returns Execution fee in native token (wei)
   */
  async getTradeExecutionFee(): Promise<bigint> {
    try {
      return await this.tradingContract.getExecutionFee();
    } catch (error) {
      console.error('Error getting execution fee:', error);
      return BigInt(0);
    }
  }

  /**
   * Get all trades for a trader
   * @param traderAddress - Trader address
   * @returns Array of trades
   */
  async getTrades(traderAddress: string): Promise<TradeResponse[]> {
    try {
      const tradesData = await this.tradingStorageContract.getOpenTrades(traderAddress);
      const trades: TradeResponse[] = [];

      for (const trade of tradesData) {
        trades.push({
          trader: trade.trader,
          pairIndex: Number(trade.pairIndex),
          index: Number(trade.index),
          initialPosUsdc: fromBlockchain6(trade.initialPosToken || trade.positionSizeUsdc),
          openPrice: fromBlockchain10(trade.openPrice),
          buy: trade.buy,
          leverage: Number(fromBlockchain10(trade.leverage)),
          tp: fromBlockchain10(trade.tp),
          sl: fromBlockchain10(trade.sl),
        });
      }

      return trades;
    } catch (error) {
      console.error('Error getting trades:', error);
      return [];
    }
  }

  /**
   * Convert order type string to numeric value
   * @param orderType - Order type string
   * @returns Numeric order type
   */
  private getOrderTypeValue(orderType: string): number {
    const orderTypes: Record<string, number> = {
      market: 0,
      limit: 1,
      stop_limit: 2,
      market_zero_fee: 3,
    };
    return orderTypes[orderType] || 0;
  }
}
