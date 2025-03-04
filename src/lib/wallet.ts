import { createWalletClient, custom, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createPublicClient, http, fallback } from 'viem';
import { writable, get, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { currentChainConfig } from './chainConfig';

// Get Alchemy API key from environment variable
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || 'demo';

// Create a store for wallet state
export const walletStore = writable<{
  address: `0x${string}` | null;
  balance: bigint | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  privateKey: `0x${string}` | null;
  isPrivateKeyAccount: boolean;
}>({
  address: null,
  balance: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  privateKey: null,
  isPrivateKeyAccount: false
});

// Create a derived store for the public client that updates when the chain changes
export const publicClient = derived(
  currentChainConfig,
  ($currentChainConfig) => createPublicClient({
    chain: $currentChainConfig.chain,
    transport: http($currentChainConfig.rpcUrl)
  })
);

// Function to update balance
export async function updateBalance() {
  const state = get(walletStore);
  const client = get(publicClient);
  
  if (state.address && state.isConnected) {
    try {
      const balance = await client.getBalance({ address: state.address });
      walletStore.update(state => ({ ...state, balance }));
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  }
}

// Subscribe to chain changes to update balance
if (browser) {
  currentChainConfig.subscribe(async () => {
    await updateBalance();
  });
}

// Function to save connection state to localStorage
function saveConnectionState(address: `0x${string}`, privateKey?: `0x${string}`) {
  if (browser) {
    localStorage.setItem('walletConnected', 'true');
    localStorage.setItem('walletAddress', address);
    
    // Save private key connection state if provided
    if (privateKey) {
      localStorage.setItem('usePrivateKey', 'true');
      localStorage.setItem('privateKey', privateKey);
    } else {
      localStorage.removeItem('usePrivateKey');
      localStorage.removeItem('privateKey');
    }
  }
}

// Function to clear connection state from localStorage
function clearConnectionState() {
  if (browser) {
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('usePrivateKey');
    localStorage.removeItem('privateKey');
  }
}

// Function to connect with private key
export async function connectWithPrivateKey(privateKey: string) {
  try {
    walletStore.update(state => ({ ...state, isConnecting: true, error: null }));
    
    // Validate and format private key
    if (!privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
    }
    
    if (privateKey.length !== 66) {
      throw new Error('Invalid private key format');
    }
    
    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const address = account.address;
    
    // Get balance using the current chain's public client
    const client = get(publicClient);
    const balance = await client.getBalance({ address });
    
    // Save connection state with private key
    saveConnectionState(address, privateKey as `0x${string}`);
    
    // Update store
    walletStore.update(state => ({
      ...state,
      address,
      balance,
      isConnected: true,
      isConnecting: false,
      privateKey: privateKey as `0x${string}`,
      isPrivateKeyAccount: true
    }));
    
    return { address, balance };
  } catch (error) {
    console.error('Error connecting with private key:', error);
    walletStore.update(state => ({
      ...state,
      isConnecting: false,
      error: error instanceof Error ? error.message : 'Unknown error connecting with private key'
    }));
    throw error;
  }
}

// Function to connect wallet
export async function connectWallet() {
  try {
    walletStore.update(state => ({ ...state, isConnecting: true, error: null }));
    
    // Check if ethereum is available
    if (!window.ethereum) {
      throw new Error('No Ethereum wallet found. Please install MetaMask or another wallet.');
    }
    
    // Get the current chain configuration
    const chainConfig = get(currentChainConfig);
    
    // Create a wallet client with the current chain
    const walletClient: WalletClient = createWalletClient({
      chain: chainConfig.chain,
      transport: custom(window.ethereum)
    });
    
    // Request accounts
    const [address] = await walletClient.requestAddresses();
    
    if (!address) {
      throw new Error('No accounts found or user rejected the connection');
    }
    
    // Get balance using the current chain's public client
    const client = get(publicClient);
    const balance = await client.getBalance({ address });
    
    // Save connection state to localStorage
    saveConnectionState(address);
    
    // Update store
    walletStore.update(state => ({
      ...state,
      address,
      balance,
      isConnected: true,
      isConnecting: false,
      privateKey: null,
      isPrivateKeyAccount: false
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
  // Clear connection state from localStorage
  clearConnectionState();
  
  walletStore.set({
    address: null,
    balance: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    privateKey: null,
    isPrivateKeyAccount: false
  });
}

// Function to format address for display
export function formatAddress(address: `0x${string}` | null): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Function to format ETH balance
export function formatEthBalance(balance: bigint | null): string {
  if (balance === null) return '0';
  return (Number(balance) / 1e18).toFixed(4);
}

// Function to initialize wallet connection from localStorage
export async function initWalletConnection() {
  if (!browser) return;
  
  const isConnected = localStorage.getItem('walletConnected') === 'true';
  const savedAddress = localStorage.getItem('walletAddress');
  const usePrivateKey = localStorage.getItem('usePrivateKey') === 'true';
  
  if (isConnected && savedAddress) {
    try {
      // Check if we have a private key connection saved - prioritize this
      if (usePrivateKey) {
        const savedPrivateKey = localStorage.getItem('privateKey');
        if (savedPrivateKey) {
          // Reconnect using the saved private key
          try {
            await connectWithPrivateKey(savedPrivateKey);
            console.log('Reconnected with saved private key');
            return; // Early return once connected with private key
          } catch (error) {
            console.error('Failed to reconnect with saved private key:', error);
            clearConnectionState(); // Clear invalid private key connection
          }
        }
      }
      
      // If we don't have a private key or it failed, try browser wallet
      if (window.ethereum) {
        // Check if the wallet is still connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        
        if (accounts.length > 0 && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
          // Get balance using the current chain's public client
          const address = savedAddress as `0x${string}`;
          const client = get(publicClient);
          const balance = await client.getBalance({ address });
          
          // Update store
          walletStore.update(state => ({
            ...state,
            address,
            balance,
            isConnected: true,
            isPrivateKeyAccount: false,
            privateKey: null
          }));
          
          // Make sure we save state without private key
          saveConnectionState(address);
        } else {
          // Clear connection state if accounts don't match
          clearConnectionState();
        }
      } else {
        clearConnectionState();
      }
    } catch (error) {
      console.error('Error initializing wallet connection:', error);
      clearConnectionState();
    }
  }
}

// Listen for account changes
if (browser && window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts: string[]) => {
    const currentState = get(walletStore);
    
    if (accounts.length === 0) {
      // User disconnected their wallet
      disconnectWallet();
    } else if (currentState.isConnected && accounts[0] !== currentState.address) {
      // Account changed, update the connection
      connectWallet().catch(console.error);
    }
  });
  
  window.ethereum.on('chainChanged', () => {
    // Reload the page when the chain changes
    window.location.reload();
  });
}

// Declare ethereum for TypeScript
declare global {
  interface Window {
    ethereum: any;
  }
} 