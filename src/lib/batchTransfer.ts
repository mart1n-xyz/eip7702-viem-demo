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
      
      // Detect browser for browser-specific handling
      const userAgent = navigator.userAgent || '';
      const isBrave = userAgent.includes("Brave");
      const isChrome = !isBrave && userAgent.includes("Chrome");
      
      reportProgress('browser_detection', `Browser detected: ${isBrave ? 'Brave' : isChrome ? 'Chrome' : 'Other'}`);
      
      // Calculate total ETH being transferred for gas estimation purposes
      const totalEthValue = Number(totalValue) / 1e18;
      reportProgress('gas_estimation', `Total ETH value: ${totalEthValue.toFixed(6)} ETH`);
      reportProgress('gas_estimation', `Number of transfers: ${calls.length}`);
      
      // First, encode the function call data
      const callData = encodeFunctionData({
        abi: BATCH_CALL_DELEGATION_ABI,
        functionName: 'execute',
        args: [calls],
      });
      
      // For EIP-7702 transactions, use an extremely generous fixed gas limit based on the number of transfers
      // Base gas (for one transfer) + additional gas per transfer
      const baseGas = BigInt(500000); // Base gas for contract execution and one transfer
      const gasPerTransfer = BigInt(100000); // Additional gas per transfer
      
      // Calculate gas limit with a very generous buffer
      const calculatedGas = baseGas + (gasPerTransfer * BigInt(calls.length));
      
      // Apply an additional safety multiplier (3x) for EIP-7702 transactions which are gas-intensive
      // Use an even higher multiplier for Chrome (4x)
      const gasMultiplier = isChrome ? BigInt(4) : BigInt(3);
      const gasLimit = calculatedGas * gasMultiplier;
      
      reportProgress('gas_estimation', `Using fixed gas calculation for EIP-7702: ${gasLimit.toString()}`);
      reportProgress('gas_estimation', `Base gas: ${baseGas.toString()}, Per transfer: ${gasPerTransfer.toString()}, Transfers: ${calls.length}, Multiplier: ${gasMultiplier.toString()}x`);
      
      // Get the chain's gas limit to ensure we don't exceed it
      const block = await publicClient.getBlock();
      const blockGasLimit = block.gasLimit;
      
      // Make sure our gas limit doesn't exceed the block gas limit
      const finalGasLimit = gasLimit > blockGasLimit ? blockGasLimit : gasLimit;
      
      if (gasLimit > blockGasLimit) {
        reportProgress('gas_estimation', `Calculated gas limit (${gasLimit.toString()}) exceeds block gas limit (${blockGasLimit.toString()}). Using block gas limit.`);
      }
      
      reportProgress('gas_estimation', `Final gas limit: ${finalGasLimit.toString()}`);
      
      // Get the latest gas price to ensure transaction doesn't get stuck
      const gasPrice = await publicClient.getGasPrice();
      const gasPriceGwei = Number(gasPrice) / 1e9;
      reportProgress('gas_estimation', `Current gas price: ${gasPriceGwei.toFixed(2)} Gwei`);
      
      // Calculate fee parameters for EIP-1559
      const maxPriorityFeePerGas = gasPrice / BigInt(5); // 20% of base fee as priority fee
      const maxFeePerGas = gasPrice * BigInt(120) / BigInt(100); // Base fee + 20% buffer
      
      // Calculate the maximum transaction fee
      const maxFee = Number(finalGasLimit * maxFeePerGas) / 1e18;
      reportProgress('gas_estimation', `Maximum estimated transaction fee: ${maxFee.toFixed(6)} ETH`);
      
      // Check if the user has enough balance for the transaction
      const userBalance = await publicClient.getBalance({ address: walletState.address });
      const userBalanceEth = Number(userBalance) / 1e18;
      
      if (userBalance < (totalValue + (finalGasLimit * maxFeePerGas))) {
        const requiredBalance = Number(totalValue + (finalGasLimit * maxFeePerGas)) / 1e18;
        reportProgress('error', `Insufficient balance. You need at least ${requiredBalance.toFixed(6)} ETH but have ${userBalanceEth.toFixed(6)} ETH.`);
        throw new Error(`Insufficient balance. You need at least ${requiredBalance.toFixed(6)} ETH but have ${userBalanceEth.toFixed(6)} ETH.`);
      }
      
      reportProgress('transaction', `Submitting transaction with gas limit: ${finalGasLimit.toString()}`);
      
      // For Chrome, use the direct sendTransaction approach first as it seems to work better
      if (isChrome) {
        reportProgress('chrome_handling', `Using Chrome-specific transaction approach...`);
        
        try {
          // Use direct transaction method for Chrome
          const hash = await walletClient.sendTransaction({
            to: walletState.address,
            value: totalValue,
            data: callData,
            gas: finalGasLimit,
            nonce,
            authorizationList: [authorization],
            maxFeePerGas,
            maxPriorityFeePerGas
          });
          
          reportProgress('transaction_complete', `✅ Transaction successfully submitted!`);
          reportProgress('transaction_complete', `Transaction hash: ${hash}`);
          reportProgress('transaction_complete', `View on ${config.chain.name} explorer: ${config.chain.blockExplorers?.default.url}/tx/${hash}`);
          return hash;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          reportProgress('chrome_error', `Chrome-specific approach failed: ${errorMessage}`);
          reportProgress('fallback', `Trying standard approach as fallback...`);
          
          // Fall back to the standard approach with even higher gas
          const fallbackGasLimit = finalGasLimit * BigInt(120) / BigInt(100);
          
          const hash = await walletClient.writeContract({
            abi: BATCH_CALL_DELEGATION_ABI,
            address: walletState.address,
            functionName: 'execute',
            args: [calls],
            value: totalValue,
            authorizationList: [authorization],
            nonce: nonce,
            gas: fallbackGasLimit,
            maxFeePerGas: maxFeePerGas * BigInt(120) / BigInt(100),
            maxPriorityFeePerGas: maxPriorityFeePerGas * BigInt(120) / BigInt(100)
          });
          
          reportProgress('transaction_complete', `✅ Transaction successfully submitted!`);
          reportProgress('transaction_complete', `Transaction hash: ${hash}`);
          reportProgress('transaction_complete', `View on ${config.chain.name} explorer: ${config.chain.blockExplorers?.default.url}/tx/${hash}`);
          return hash;
        }
      } else {
        // Standard approach for Brave and other browsers
        const hash = await walletClient.writeContract({
          abi: BATCH_CALL_DELEGATION_ABI,
          address: walletState.address,
          functionName: 'execute',
          args: [calls],
          value: totalValue,
          authorizationList: [authorization],
          nonce: nonce,
          gas: finalGasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas
        }).catch(async (error) => {
          // If the transaction fails, try a fallback approach with direct transaction
          reportProgress('fallback', `Primary transaction failed. Using fallback approach...`);
          reportProgress('fallback', `Error: ${error?.message || 'Unknown error'}`);
          
          // Try with an even higher gas limit for the fallback
          const fallbackGasLimit = finalGasLimit * BigInt(120) / BigInt(100); // 20% more gas
          reportProgress('gas_estimation', `Fallback gas limit: ${fallbackGasLimit.toString()}`);
          
          // Use a more direct approach
          return await walletClient.sendTransaction({
            to: walletState.address,
            value: totalValue,
            data: callData,
            gas: fallbackGasLimit,
            nonce,
            authorizationList: [authorization],
            maxFeePerGas: maxFeePerGas * BigInt(120) / BigInt(100),
            maxPriorityFeePerGas: maxPriorityFeePerGas * BigInt(120) / BigInt(100)
          });
        });

        reportProgress('transaction_complete', `✅ Transaction successfully submitted!`);
        reportProgress('transaction_complete', `Transaction hash: ${hash}`);
        reportProgress('transaction_complete', `View on ${config.chain.name} explorer: ${config.chain.blockExplorers?.default.url}/tx/${hash}`);
        return hash;
      }
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