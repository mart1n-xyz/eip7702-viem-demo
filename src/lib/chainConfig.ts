import { writable } from 'svelte/store';
import { sepolia, holesky, type Chain } from 'viem/chains';

// Get Alchemy API key from environment variable
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
  throw new Error('Missing Alchemy API key in environment variables');
}

export type ChainConfig = {
  chain: Chain;
  rpcUrl: string;
  batchCallDelegationAddress: `0x${string}`;
};

// Chain configurations
export const chainConfigs = {
  sepolia: {
    chain: sepolia,
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    batchCallDelegationAddress: '0x6987E30398b2896B5118ad1076fb9f58825a6f1a'
  },
  holesky: {
    chain: holesky,
    rpcUrl: `https://eth-holesky.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    batchCallDelegationAddress: '0x979dd1ab4a7e3b3370b1daceec8b4198f97e0d6f' as `0x${string}`
  }
} as const;

// Get the initial network from localStorage or default to holesky
const getInitialNetwork = () => {
  if (typeof window === 'undefined') return 'holesky';
  const stored = localStorage.getItem('selectedNetwork');
  return (stored === 'sepolia' || stored === 'holesky') ? stored : 'holesky';
};

// Create a store for the current chain configuration
export const currentChainConfig = writable<ChainConfig>(chainConfigs[getInitialNetwork()]);

// Function to switch networks
export function switchNetwork(network: keyof typeof chainConfigs) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('selectedNetwork', network);
  }
  currentChainConfig.set(chainConfigs[network]);
} 