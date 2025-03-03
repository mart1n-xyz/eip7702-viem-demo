import { createPublicClient, createWalletClient, http, type Address, encodeFunctionData } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { walletStore } from './wallet';
import { get } from 'svelte/store';
// Import the eip7702Actions from viem/experimental
import { eip7702Actions } from 'viem/experimental';
import { currentChainConfig } from './chainConfig';

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

// Create a public client for reading from the blockchain
export const publicClient = createPublicClient({
  chain: get(currentChainConfig).chain,
  transport: http(get(currentChainConfig).rpcUrl)
});

// Subscribe to chain changes and update the public client
currentChainConfig.subscribe((config) => {
  Object.assign(publicClient, {
    chain: config.chain,
    transport: http(config.rpcUrl)
  });
});

// Type for progress callback
export type ProgressCallback = (step: string, message: string) => void;

// Type for signing confirmation
export type SigningConfirmation = {
  title: string;
  message: string;
  data: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

// Helper function to make data JSON-serializable
const prepareDataForDisplay = (data: any): any => {
  if (typeof data === 'bigint') {
    return data.toString();
  }
  if (Array.isArray(data)) {
    return data.map(prepareDataForDisplay);
  }
  if (typeof data === 'object' && data !== null) {
    const result: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = prepareDataForDisplay(value);
    }
    return result;
  }
  return data;
};

// Function to perform a batch transfer
export async function batchTransfer(
  transfers: Array<{ to: Address; value: bigint; data?: `0x${string}` }>,
  onProgress?: ProgressCallback,
  onSigningRequest?: (confirmation: SigningConfirmation) => Promise<void>
) {
  const walletState = get(walletStore);
  const config = get(currentChainConfig);
  
  if (!walletState.address) {
    throw new Error('Wallet not connected');
  }
  
  // Format the calls for the BatchCallDelegation contract
  const calls = transfers.map(transfer => ({
    data: '0x' as `0x${string}`, // Empty data for simple ETH transfers
    to: transfer.to,
    value: transfer.value
  }));
  
  // Calculate the total value to send
  const totalValue = transfers.reduce((sum, transfer) => sum + transfer.value, 0n);
  
  // Helper function to report progress
  const reportProgress = (step: string, message: string) => {
    console.log(`[${step}] ${message}`);
    if (onProgress) onProgress(step, message);
  };

  // Helper function to request signing confirmation
  const requestSigningConfirmation = async (title: string, message: string, data: string): Promise<void> => {
    if (!onSigningRequest) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      onSigningRequest({
        title,
        message,
        data,
        onConfirm: async () => {
          resolve();
        },
        onCancel: () => {
          reject(new Error('User rejected signing request'));
        }
      });
    });
  };
  
  try {
    // Create wallet client based on connection type
    const walletClient = walletState.isPrivateKeyAccount && walletState.privateKey
      ? createWalletClient({
          account: privateKeyToAccount(walletState.privateKey),
          chain: config.chain,
          transport: http(config.rpcUrl)
        }).extend(eip7702Actions())
      : createWalletClient({
          account: walletState.address,
          chain: config.chain,
          transport: http(config.rpcUrl)
        }).extend(eip7702Actions());

    reportProgress('preparing', walletState.isPrivateKeyAccount 
      ? 'Preparing EIP-7702 batch transfer with private key account...'
      : 'Preparing EIP-7702 batch transfer with connected wallet...');

    reportProgress('preparing', `Preparing to transfer to ${transfers.length} recipients`);
    reportProgress('preparing', `Total value: ${(Number(totalValue) / 10**18).toFixed(6)} ETH`);
    reportProgress('preparing', `Network: ${config.chain.name}`);

    // Show authorization data before signing
    const authorizationData = {
      contractAddress: config.batchCallDelegationAddress,
      chain: config.chain.name,
      account: walletState.address
    };

    reportProgress('authorization', 'Preparing authorization signature for EIP-7702');
    reportProgress('authorization', `Contract address: ${config.batchCallDelegationAddress}`);
    reportProgress('authorization', `This signature will authorize the contract to execute transactions on your behalf`);

    // Request confirmation for authorization signing
    await requestSigningConfirmation(
      'Sign EIP-7702 Authorization',
      'Please review the authorization data that will designate the BatchCallDelegation contract to your account:',
      JSON.stringify(prepareDataForDisplay(authorizationData), null, 2)
    );

    // Get authorization for the contract
    const authorization = await walletClient.signAuthorization({
      contractAddress: config.batchCallDelegationAddress,
    });

    reportProgress('authorization', walletState.isPrivateKeyAccount 
      ? `Authorization signed with private key for account ${walletState.address.slice(0, 6)}...${walletState.address.slice(-4)}`
      : `Authorization signed by wallet for ${config.batchCallDelegationAddress.slice(0, 6)}...${config.batchCallDelegationAddress.slice(-4)} contract on ${config.chain.name}`);

    // Prepare transaction data for display
    const transactionData = {
      contract: config.batchCallDelegationAddress,
      function: 'execute',
      calls: calls.map(call => ({
        to: call.to,
        value: call.value.toString(),
        data: call.data
      })),
      totalValue: totalValue.toString(),
      chainId: config.chain.id,
      from: walletState.address,
      eip7702: {
        contractAddress: config.batchCallDelegationAddress,
        authorization: authorization
      }
    };

    // Request confirmation for transaction
    await requestSigningConfirmation(
      'Sign Transaction',
      'Please review the transaction data that will be executed:\n\n' +
      '• This is an EIP-7702 transaction that will execute from YOUR address\n' +
      '• The authorization signature you provided earlier allows the BatchCallDelegation contract to temporarily execute code in your account\'s context\n' +
      '• The contract will execute multiple transfers in a single transaction, saving gas\n' +
      '• Notice that the "to" address is your own address, not the contract address - this is a key feature of EIP-7702\n\n' +
      'Transaction details:',
      JSON.stringify(prepareDataForDisplay(transactionData), null, 2)
    );

    // Get the latest nonce for the account to avoid nonce issues
    const nonce = await publicClient.getTransactionCount({
      address: walletState.address
    });
    
    reportProgress('preparing', `Preparing batch transfer with ${transfers.length} recipient(s)`);
    reportProgress('preparing', `Total value: ${(Number(totalValue) / 10**18).toFixed(6)} ETH on ${config.chain.name}`);
    reportProgress('preparing', `Using account: ${walletState.address}`);
    reportProgress('preparing', `Current nonce: ${nonce}`);

    // Send the transaction with proper nonce handling
    try {
      reportProgress('transaction', `Submitting transaction to the network...`);
      
      const hash = await walletClient.writeContract({
        abi: BATCH_CALL_DELEGATION_ABI,
        address: walletState.address,
        functionName: 'execute',
        args: [calls],
        value: totalValue,
        authorizationList: [authorization],
        nonce: nonce // Explicitly setting the nonce
      });

      reportProgress('transaction_complete', `✅ Transaction successfully submitted!`);
      reportProgress('transaction_complete', `Transaction hash: ${hash}`);
      reportProgress('transaction_complete', `View on ${config.chain.name} explorer: ${config.chain.blockExplorers?.default.url}/tx/${hash}`);
      return hash;
    } catch (error: any) {
      // Check if it's a nonce error and retry if needed
      if (error?.message?.includes('nonce too low') || error?.message?.includes('nonce')) {
        reportProgress('transaction_retry', `Nonce error detected: ${error.message}`);
        
        // Get an updated nonce and retry
        const updatedNonce = await publicClient.getTransactionCount({
          address: walletState.address,
          blockTag: 'pending' // Use pending to get the latest possible nonce
        });
        
        reportProgress('transaction_retry', `Updating nonce from ${nonce} to ${updatedNonce}`);
        reportProgress('transaction_retry', `Retrying transaction with updated nonce...`);
        
        const hash = await walletClient.writeContract({
          abi: BATCH_CALL_DELEGATION_ABI,
          address: walletState.address,
          functionName: 'execute',
          args: [calls],
          value: totalValue,
          authorizationList: [authorization],
          nonce: updatedNonce
        });
        
        reportProgress('transaction_complete', `✅ Transaction successfully submitted after nonce retry!`);
        reportProgress('transaction_complete', `Transaction hash: ${hash}`);
        reportProgress('transaction_complete', `View on ${config.chain.name} explorer: ${config.chain.blockExplorers?.default.url}/tx/${hash}`);
        return hash;
      }
      
      // Handle other types of errors with more detailed messages
      if (error?.message) {
        if (error.message.includes('user rejected')) {
          reportProgress('error', `Transaction was rejected by the user`);
        } else if (error.message.includes('insufficient funds')) {
          reportProgress('error', `Insufficient funds for transaction. Make sure you have enough ETH to cover the transfer amount plus gas fees.`);
        } else if (error.message.includes('gas')) {
          reportProgress('error', `Gas estimation failed: ${error.message}`);
        } else {
          reportProgress('error', `Transaction failed: ${error.message}`);
        }
      } else {
        reportProgress('error', `Unknown error occurred during transaction`);
      }
      
      // If it's not a nonce error, rethrow
      throw error;
    }
  } catch (error) {
    console.error('EIP-7702 error:', error);
    throw error;
  }
} 