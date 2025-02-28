import { createWalletClient, custom, type WalletClient } from 'viem';
import { sepolia } from 'viem/chains';
import { createPublicClient, http, fallback } from 'viem';
import { writable } from 'svelte/store';

// Get Infura API key from environment variable
const INFURA_API_KEY = import.meta.env.VITE_INFURA_API_KEY;

// Create a store for wallet state
export const walletStore = writable<{
  address: string | null;
  balance: bigint | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}>({
  address: null,
  balance: null,
  isConnected: false,
  isConnecting: false,
  error: null
});

// Create a public client for Sepolia with Infura as primary and fallbacks
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http(`https://sepolia.infura.io/v3/${INFURA_API_KEY}`),
    http('https://eth-sepolia.g.alchemy.com/v2/demo'),
    http('https://sepolia.gateway.tenderly.co')
  ])
});

// Function to connect wallet
export async function connectWallet() {
  try {
    walletStore.update(state => ({ ...state, isConnecting: true, error: null }));
    
    // Check if ethereum is available
    if (!window.ethereum) {
      throw new Error('No Ethereum wallet found. Please install MetaMask or another wallet.');
    }
    
    // Create a wallet client
    const walletClient: WalletClient = createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum)
    });
    
    // Request accounts
    const [address] = await walletClient.requestAddresses();
    
    if (!address) {
      throw new Error('No accounts found or user rejected the connection');
    }
    
    // Get balance
    const balance = await publicClient.getBalance({ address });
    
    // Update store
    walletStore.update(state => ({
      ...state,
      address,
      balance,
      isConnected: true,
      isConnecting: false
    }));
    
    return { address, balance };
  } catch (error) {
    console.error('Error connecting wallet:', error);
    walletStore.update(state => ({
      ...state,
      isConnecting: false,
      error: error instanceof Error ? error.message : 'Unknown error connecting wallet'
    }));
    throw error;
  }
}

// Function to disconnect wallet
export function disconnectWallet() {
  walletStore.set({
    address: null,
    balance: null,
    isConnected: false,
    isConnecting: false,
    error: null
  });
}

// Function to format address for display
export function formatAddress(address: string | null): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Function to format ETH balance
export function formatEthBalance(balance: bigint | null): string {
  if (balance === null) return '0';
  return (Number(balance) / 1e18).toFixed(4);
}

// Declare ethereum for TypeScript
declare global {
  interface Window {
    ethereum: any;
  }
} 