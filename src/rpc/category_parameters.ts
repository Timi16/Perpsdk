import { Contract, Provider } from 'ethers';
import { OpenInterest, Utilization, Skew, fromBlockchain6 } from '../types';
import { PairsCache } from './pairs_cache';

/**
 * RPC module for retrieving category-level parameters
 */
export class CategoryParametersRPC {
  private provider: Provider;
  private pairStorageContract: Contract;
  private pairsCache: PairsCache;

  constructor(
    provider: Provider,
    pairStorageContract: Contract,
    pairsCache: PairsCache
  ) {
    this.provider = provider;
    this.pairStorageContract = pairStorageContract;
    this.pairsCache = pairsCache;
  }

  /**
   * Get open interest limits per category
   * @returns Map of group index to OI limits
   */
  async getOILimits(): Promise<Map<number, OpenInterest>> {
    const groupIndexes = await this.pairsCache.getGroupIndexes();
    const limits = new Map<number, OpenInterest>();

    for (const groupIndex of groupIndexes) {
      try {
        const maxOI = await this.pairStorageContract.groupCollateral(groupIndex, true); // true = max OI
        limits.set(groupIndex, {
          long: fromBlockchain6(maxOI),
          short: fromBlockchain6(maxOI),
          max: fromBlockchain6(maxOI),
        });
      } catch (error) {
        console.error(`Error getting OI limits for group ${groupIndex}:`, error);
      }
    }

    return limits;
  }

  /**
   * Get current open interest per category
   * @returns Map of group index to OI
   */
  async getOI(): Promise<Map<number, OpenInterest>> {
    const groupIndexes = await this.pairsCache.getGroupIndexes();
    const oi = new Map<number, OpenInterest>();

    for (const groupIndex of groupIndexes) {
      try {
        const groupOILong = await this.pairStorageContract.groupOI(groupIndex, 0); // 0 = long
        const groupOIShort = await this.pairStorageContract.groupOI(groupIndex, 1); // 1 = short

        const limits = await this.getOILimits();
        const maxOI = limits.get(groupIndex)?.max || 0;

        oi.set(groupIndex, {
          long: fromBlockchain6(groupOILong),
          short: fromBlockchain6(groupOIShort),
          max: maxOI,
        });
      } catch (error) {
        console.error(`Error getting OI for group ${groupIndex}:`, error);
      }
    }

    return oi;
  }

  /**
   * Get utilization per category
   * @returns Map of group index to utilization
   */
  async getUtilization(): Promise<Map<number, Utilization>> {
    const oi = await this.getOI();
    const utilization = new Map<number, Utilization>();

    for (const [groupIndex, oiData] of oi) {
      const utilizationLong = oiData.max > 0 ? (oiData.long / oiData.max) * 100 : 0;
      const utilizationShort = oiData.max > 0 ? (oiData.short / oiData.max) * 100 : 0;

      utilization.set(groupIndex, {
        utilizationLong,
        utilizationShort,
      });
    }

    return utilization;
  }

  /**
   * Get category skew (long / total)
   * @returns Map of group index to skew
   */
  async getCategorySkew(): Promise<Map<number, Skew>> {
    const oi = await this.getOI();
    const skew = new Map<number, Skew>();

    for (const [groupIndex, oiData] of oi) {
      const total = oiData.long + oiData.short;
      const skewValue = total > 0 ? oiData.long / total : 0.5;

      skew.set(groupIndex, { skew: skewValue });
    }

    return skew;
  }
}
