import { Contract, Provider } from 'ethers';
import { Snapshot, Group, PairData } from '../types';
import { PairsCache } from './pairs_cache';
import { AssetParametersRPC } from './asset_parameters';
import { CategoryParametersRPC } from './category_parameters';
import { FeeParametersRPC } from './fee_parameters';
import { BlendedRPC } from './blended';

/**
 * RPC module for aggregating all market data into a snapshot
 */
export class SnapshotRPC {
  private pairsCache: PairsCache;
  private assetParams: AssetParametersRPC;
  private categoryParams: CategoryParametersRPC;
  private feeParams: FeeParametersRPC;
  private blendedParams: BlendedRPC;

  constructor(
    pairsCache: PairsCache,
    assetParams: AssetParametersRPC,
    categoryParams: CategoryParametersRPC,
    feeParams: FeeParametersRPC,
    blendedParams: BlendedRPC
  ) {
    this.pairsCache = pairsCache;
    this.assetParams = assetParams;
    this.categoryParams = categoryParams;
    this.feeParams = feeParams;
    this.blendedParams = blendedParams;
  }

  /**
   * Get comprehensive market snapshot with all data
   * @returns Snapshot object containing all market parameters
   */
  async getSnapshot(): Promise<Snapshot> {
    console.log('Fetching market snapshot...');

    // Fetch all data in parallel for performance
    const [
      pairs,
      groupIndexes,
      assetOI,
      categoryOI,
      assetUtilization,
      categoryUtilization,
      assetSkew,
      categorySkew,
      blendedUtilization,
      blendedSkew,
      fees,
      depth,
    ] = await Promise.all([
      this.pairsCache.getPairsInfo(),
      this.pairsCache.getGroupIndexes(),
      this.assetParams.getOI(),
      this.categoryParams.getOI(),
      this.assetParams.getUtilization(),
      this.categoryParams.getUtilization(),
      this.assetParams.getAssetSkew(),
      this.categoryParams.getCategorySkew(),
      this.blendedParams.getBlendedUtilization(),
      this.blendedParams.getBlendedSkew(),
      this.feeParams.getMarginFee(),
      this.assetParams.getOnePercentDepth(),
    ]);

    // Build snapshot structure
    const snapshot: Snapshot = {
      groups: {},
    };

    // Group pairs by category
    for (const groupIndex of groupIndexes) {
      const group: Group = {
        groupIndex,
        pairs: {},
        openInterest: categoryOI.get(groupIndex),
        utilization: categoryUtilization.get(groupIndex),
        skew: categorySkew.get(groupIndex),
      };

      // Get all pairs in this group
      const pairsInGroup = await this.pairsCache.getPairsInGroup(groupIndex);

      for (const pairIndex of pairsInGroup) {
        const pairInfo = pairs.get(pairIndex);
        if (!pairInfo) continue;

        const pairName = `${pairInfo.from}/${pairInfo.to}`;

        const pairData: PairData = {
          pairInfo,
          openInterest: assetOI.get(pairIndex),
          utilization: blendedUtilization.get(pairIndex),
          skew: blendedSkew.get(pairIndex),
          fee: fees.get(pairIndex),
          depth: {
            onePercentDepthAboveUsdc: depth.get(pairIndex)?.above || 0,
            onePercentDepthBelowUsdc: depth.get(pairIndex)?.below || 0,
          },
          spread: pairInfo.spread.min,
        };

        group.pairs[pairName] = pairData;
      }

      snapshot.groups[`group_${groupIndex}`] = group;
    }

    console.log('Market snapshot complete');
    return snapshot;
  }

  /**
   * Get snapshot for a specific group
   * @param groupIndex - Group index
   * @returns Group data
   */
  async getGroupSnapshot(groupIndex: number): Promise<Group | undefined> {
    const snapshot = await this.getSnapshot();
    return snapshot.groups[`group_${groupIndex}`];
  }

  /**
   * Get snapshot for a specific pair
   * @param pairName - Pair name (e.g., "BTC/USD")
   * @returns Pair data
   */
  async getPairSnapshot(pairName: string): Promise<PairData | undefined> {
    const snapshot = await this.getSnapshot();

    // Find the pair in all groups
    for (const group of Object.values(snapshot.groups)) {
      if (group.pairs[pairName]) {
        return group.pairs[pairName];
      }
    }

    return undefined;
  }
}
