import { Contract, Provider } from 'ethers';
import { PairInfo, PairInfoSchema, fromBlockchain10, fromBlockchain6 } from '../types';
import { API_ENDPOINTS } from '../config';

/**
 * RPC module for caching and managing trading pair information
 */
export class PairsCache {
  private provider: Provider;
  private pairStorageContract: Contract;
  private pairsCache?: Map<number, PairInfo>;
  private pairNameToIndexMap?: Map<string, number>;

  constructor(provider: Provider, pairStorageContract: Contract) {
    this.provider = provider;
    this.pairStorageContract = pairStorageContract;
  }

  /**
   * Get all trading pairs from blockchain (with caching)
   * @param forceRefresh - Force refresh from blockchain
   * @returns Map of pair index to PairInfo
   */
  async getPairsInfo(forceRefresh: boolean = false): Promise<Map<number, PairInfo>> {
    if (this.pairsCache && !forceRefresh) {
      return this.pairsCache;
    }

    const pairs = new Map<number, PairInfo>();
    const pairNameToIndex = new Map<string, number>();

    try {
      // Get pairs count
      const pairsCount = await this.pairStorageContract.pairsCount();
      const count = Number(pairsCount);

      // Fetch all pairs
      for (let i = 0; i < count; i++) {
        const pairData = await this.pairStorageContract.pairs(i);

        const pairInfo: PairInfo = {
          from: pairData.from,
          to: pairData.to,
          spread: {
            min: fromBlockchain10(pairData.spreadP || pairData.spread?.min || 0),
            max: fromBlockchain10(pairData.spreadP || pairData.spread?.max || 0),
          },
          groupIndex: Number(pairData.groupIndex),
          feeIndex: Number(pairData.feeIndex),
          maxLeverage: fromBlockchain10(pairData.maxLeverage),
          maxOpenInterestUsdc: fromBlockchain6(pairData.maxOpenInterestUsdc || 0),
        };

        pairs.set(i, pairInfo);
        pairNameToIndex.set(`${pairInfo.from}/${pairInfo.to}`, i);
      }

      this.pairsCache = pairs;
      this.pairNameToIndexMap = pairNameToIndex;

      return pairs;
    } catch (error) {
      console.error('Error fetching pairs info from blockchain:', error);
      throw error;
    }
  }

  /**
   * Get pair information from socket API
   * @returns Pair information from API
   */
  async getPairInfoFromSocket(): Promise<any> {
    try {
      const response = await fetch(API_ENDPOINTS.SOCKET_API);
      if (!response.ok) {
        throw new Error(`Failed to fetch from socket API: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching pair info from socket API:', error);
      throw error;
    }
  }

  /**
   * Get pair index from pair name
   * @param pairName - Pair name (e.g., "BTC/USD")
   * @returns Pair index or undefined if not found
   */
  async getPairIndex(pairName: string): Promise<number | undefined> {
    if (!this.pairNameToIndexMap) {
      await this.getPairsInfo();
    }
    return this.pairNameToIndexMap?.get(pairName);
  }

  /**
   * Get pair name from index
   * @param pairIndex - Pair index
   * @returns Pair name or undefined if not found
   */
  async getPairName(pairIndex: number): Promise<string | undefined> {
    if (!this.pairsCache) {
      await this.getPairsInfo();
    }
    const pair = this.pairsCache?.get(pairIndex);
    return pair ? `${pair.from}/${pair.to}` : undefined;
  }

  /**
   * Get all unique group indexes
   * @returns Array of group indexes
   */
  async getGroupIndexes(): Promise<number[]> {
    const pairs = await this.getPairsInfo();
    const groupIndexes = new Set<number>();

    pairs.forEach((pair) => {
      groupIndexes.add(pair.groupIndex);
    });

    return Array.from(groupIndexes).sort((a, b) => a - b);
  }

  /**
   * Get all pairs in a specific group
   * @param groupIndex - Group index
   * @returns Array of pair indexes in the group
   */
  async getPairsInGroup(groupIndex: number): Promise<number[]> {
    const pairs = await this.getPairsInfo();
    const pairsInGroup: number[] = [];

    pairs.forEach((pair, index) => {
      if (pair.groupIndex === groupIndex) {
        pairsInGroup.push(index);
      }
    });

    return pairsInGroup;
  }

  /**
   * Get pair info by index
   * @param pairIndex - Pair index
   * @returns PairInfo or undefined
   */
  async getPairByIndex(pairIndex: number): Promise<PairInfo | undefined> {
    const pairs = await this.getPairsInfo();
    return pairs.get(pairIndex);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.pairsCache = undefined;
    this.pairNameToIndexMap = undefined;
  }
}
