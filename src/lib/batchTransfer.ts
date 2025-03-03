import { createPublicClient, createWalletClient, http, type Address, encodeFunctionData } from 'viem';
import { sepolia } from 'viem/chains';
import { walletStore } from './wallet';
import { get } from 'svelte/store';
// Import the eip7702Actions from viem/experimental
import { eip7702Actions } from 'viem/experimental';

// BatchCallDelegation contract address - deployed on Sepolia
export const BATCH_CALL_DELEGATION_ADDRESS = '0x6987E30398b2896B5118ad1076fb9f58825a6f1a' as Address;

// BatchCallDelegation contract ABI
export const BATCH_CALL_DELEGATION_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'data', type: 'bytes' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' }
        ],
        name: 'calls',
        type: 'tuple[]'
      }
    ],
    name: 'execute',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

// Get Alchemy API key from environment variable
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || 'demo';

// Alchemy RPC endpoint for Sepolia
const ALCHEMY_RPC_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Create a public client for reading from the blockchain
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(ALCHEMY_RPC_URL)
});

// Define a type for progress callbacks
type ProgressCallback = (step: string, message: string) => void;

// Function to perform a batch transfer
export async function batchTransfer(
  transfers: Array<{ to: Address; value: bigint; data?: `0x${string}` }>,
  onProgress?: ProgressCallback
) {
  const { address } = get(walletStore);
  
  if (!address) {
    throw new Error('Wallet not connected');
  }
  
  // Format the calls for the BatchCallDelegation contract
  const calls = transfers.map((transfer) => ({
    to: transfer.to,
    value: transfer.value,
    data: transfer.data || '0x' as `0x${string}`
  }));
  
  // Calculate the total value to send
  const totalValue = transfers.reduce((sum, transfer) => sum + transfer.value, 0n);
  
  // Helper function to report progress
  const reportProgress = (step: string, message: string) => {
    console.log(`[${step}] ${message}`);
    if (onProgress) onProgress(step, message);
  };
  
  try {
    // Create wallet client with EIP-7702 actions
    const walletClient = createWalletClient({
      account: address,
      chain: sepolia,
      transport: http(ALCHEMY_RPC_URL)
    }).extend(eip7702Actions());
    
    // Step 1: Sign the authorization for EIP-7702
    reportProgress('authorization', 'Signing authorization for EIP-7702...');
    
    const authorization = await walletClient.signAuthorization({
      contractAddress: BATCH_CALL_DELEGATION_ADDRESS,
    });
    
    reportProgress('authorization_complete', 'Authorization signed successfully');
    
    // Step 2: Execute the batch transfer with the authorization
    reportProgress('transaction', 'Please approve the transaction in your wallet...');
    
    const hash = await walletClient.writeContract({
      abi: BATCH_CALL_DELEGATION_ABI,
      address: address, // Important: We're calling the function on the EOA, not the contract
      functionName: 'execute',
      args: [calls],
      value: totalValue,
      authorizationList: [authorization],
    });
    
    reportProgress('transaction_complete', `Transaction submitted with hash: ${hash}`);
    return hash;
  } catch (error) {
    console.error('EIP-7702 error:', error);
    
    // If we get an error about JSON-RPC accounts, fall back to the direct method
    if (error instanceof Error && 
        (error.message.includes('json-rpc') || 
         error.message.includes('JSON-RPC'))) {
      reportProgress('fallback', 'Wallet does not support EIP-7702 actions API, trying fallback method...');
      
      // Encode the function data using viem's encodeFunctionData
      const data = encodeFunctionData({
        abi: BATCH_CALL_DELEGATION_ABI,
        functionName: 'execute',
        args: [calls]
      });
      
      // Create the transaction request
      const transactionRequest = {
        from: address,
        to: address,
        data,
        value: `0x${totalValue.toString(16)}`,
        // Try with the standard EIP-7702 format
        eip7702: {
          address: BATCH_CALL_DELEGATION_ADDRESS,
          signature: '0x', // Empty signature for direct delegation
          calldata: '0x'
        }
      };
      
      if (!window.ethereum) {
        throw new Error('No Ethereum provider found');
      }
      
      try {
        reportProgress('transaction', 'Please approve the transaction with EIP-7702 metadata in your wallet...');
        
        const hash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [transactionRequest]
        });
        
        reportProgress('transaction_complete', `Transaction submitted with hash: ${hash}`);
        return hash as `0x${string}`;
      } catch (innerError) {
        console.error('EIP-7702 direct transaction error:', innerError);
        
        // If the wallet doesn't support the eip7702 field, try with the delegation field
        if (innerError instanceof Error && 
            (innerError.message.includes('eip7702') || 
             innerError.message.includes('unknown field'))) {
          reportProgress('fallback', 'Trying alternative delegation format...');
          
          const alternativeRequest = {
            from: address,
            to: address,
            data,
            value: `0x${totalValue.toString(16)}`,
            delegation: {
              delegateTo: BATCH_CALL_DELEGATION_ADDRESS,
              delegateData: '0x'
            }
          };
          
          reportProgress('transaction', 'Please approve the transaction with delegation metadata in your wallet...');
          
          const hash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [alternativeRequest]
          });
          
          reportProgress('transaction_complete', `Transaction submitted with hash: ${hash}`);
          return hash as `0x${string}`;
        }
        
        throw innerError;
      }
    }
    
    throw error;
  }
} 