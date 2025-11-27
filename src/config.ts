/**
 * Configuration file containing contract addresses and API endpoints
 * for Avantis trading platform
 */

export interface ContractAddresses {
  TradingStorage: string;
  PairStorage: string;
  PairInfos: string;
  PriceAggregator: string;
  USDC: string;
  Trading: string;
  Multicall: string;
  Referral: string;
}

/**
 * Mainnet contract addresses for Avantis
 * Update these addresses based on the network you're using
 */
export const CONTRACTS: ContractAddresses = {
  TradingStorage: '0x0000000000000000000000000000000000000000', // Replace with actual address
  PairStorage: '0x0000000000000000000000000000000000000000', // Replace with actual address
  PairInfos: '0x0000000000000000000000000000000000000000', // Replace with actual address
  PriceAggregator: '0x0000000000000000000000000000000000000000', // Replace with actual address
  USDC: '0x0000000000000000000000000000000000000000', // Replace with actual address
  Trading: '0x0000000000000000000000000000000000000000', // Replace with actual address
  Multicall: '0x0000000000000000000000000000000000000000', // Replace with actual address
  Referral: '0x0000000000000000000000000000000000000000', // Replace with actual address
};

/**
 * API endpoints for Avantis services
 */
export const API_ENDPOINTS = {
  SOCKET_API: 'https://socket-api-pub.avantisfi.com/socket-api/v1/data',
  PYTH_WS: 'wss://hermes.pyth.network/ws',
  PYTH_HTTP: 'https://hermes.pyth.network/v2/updates/price/latest',
};

/**
 * Network configuration
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  contracts: ContractAddresses;
}

/**
 * Get contract address by name
 */
export function getContractAddress(contractName: keyof ContractAddresses): string {
  return CONTRACTS[contractName];
}

/**
 * Update contract addresses (useful for testing or different networks)
 */
export function setContractAddresses(addresses: Partial<ContractAddresses>): void {
  Object.assign(CONTRACTS, addresses);
}
