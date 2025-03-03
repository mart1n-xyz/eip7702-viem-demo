<script lang="ts">
	import { walletStore } from '$lib/wallet';
	import { sepolia, holesky } from 'viem/chains';
	import { batchTransfer } from '$lib/batchTransfer';
	import { chainConfigs, currentChainConfig } from '$lib/chainConfig';
	import { parseEther, type Address } from 'viem';
	import { onMount } from 'svelte';

	// Get current chain from config
	$: currentChain = $currentChainConfig.chain;
	$: isCorrectChain =
		$walletStore.isConnected && window?.ethereum?.chainId === `0x${currentChain.id.toString(16)}`;

	// Check if connected to the correct chain and handle network changes
	$: {
		if ($walletStore.isConnected && currentChain && window?.ethereum?.chainId !== `0x${currentChain.id.toString(16)}`) {
			switchNetwork(currentChain.name === 'Sepolia' ? sepolia : holesky);
		}
	}

	// Function to switch network
	function switchNetwork(targetChain: typeof sepolia | typeof holesky) {
		if (window.ethereum) {
			window.ethereum
				.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: `0x${targetChain.id.toString(16)}` }]
				})
				.catch(console.error);
		}
	}

	// State for batch transfer form
	let recipients: string[] = ['', '']; // Start with 2 recipients
	let amounts: string[] = ['0.01', '0.01']; // Prefill with 0.01 ETH
	let isSubmitting = false;
	let txHash: string | null = null;
	let error: string | null = null;
	let logs: string[] = [];
	let showContractCode = false;

	// List of log messages to filter out
	const filteredLogMessages = [
		'Contract code copied to clipboard',
		'Expanded contract code',
		'Collapsed contract code',
		'Added new recipient field',
		'Removed recipient field'
	];

	// Add a new recipient field
	function addRecipient() {
		recipients = [...recipients, ''];
		amounts = [...amounts, '0.01']; // Prefill with 0.01 ETH
		// Silent operation - no log
	}

	// Remove a recipient field
	function removeRecipient(index: number) {
		if (recipients.length <= 2) {
			error = 'Minimum 2 recipients required';
			addLog('Cannot remove recipient: minimum 2 recipients required');
			return;
		}

		recipients = recipients.filter((_, i) => i !== index);
		amounts = amounts.filter((_, i) => i !== index);
		// Silent operation - no log
	}

	// Add a log entry
	function addLog(message: string) {
		// Skip logging for filtered messages
		if (filteredLogMessages.some(filter => message.includes(filter))) {
			return;
		}
		
		const timestamp = new Date().toLocaleTimeString();
		logs = [`[${timestamp}] ${message}`, ...logs];
		if (logs.length > 50) logs = logs.slice(0, 50);
	}

	// Toggle contract code visibility
	function toggleContractCode() {
		showContractCode = !showContractCode;
		// Silent operation - no log
	}

	// Submit the batch transfer
	async function submitBatchTransfer() {
		try {
			isSubmitting = true;
			error = null;
			txHash = null;
			addLog('Preparing batch transfer...');

			// Validate inputs
			const transfers = recipients.map((recipient, index) => {
				if (!recipient || !amounts[index]) {
					throw new Error('All recipient addresses and amounts must be filled');
				}

				if (!recipient.startsWith('0x') || recipient.length !== 42) {
					throw new Error(`Invalid Ethereum address: ${recipient}`);
				}

				const amount = parseEther(amounts[index]);

				return {
					to: recipient as Address,
					value: amount
				};
			});

			addLog(`Preparing EIP-7702 batch transfer to ${transfers.length} recipients...`);
			
			// Execute batch transfer with EIP-7702 with progress callback
			const hash = await batchTransfer(transfers, (step, message) => {
				switch (step) {
					case 'authorization':
						addLog('Step 1: Requesting authorization signature. Please check your wallet...');
						break;
					case 'authorization_complete':
						addLog('Authorization successfully signed!');
						break;
					case 'transaction':
						addLog('Step 2: Please approve the transaction in your wallet...');
						break;
					case 'transaction_complete':
						addLog(`Transaction submitted: ${message}`);
						break;
					case 'fallback':
						addLog(`Fallback: ${message}`);
						break;
					default:
						addLog(message);
				}
			});
			
			txHash = hash;
			addLog(`Transaction complete with hash: ${hash}`);
		} catch (err) {
			console.error('Batch transfer error:', err);
			error = err instanceof Error ? err.message : 'An unknown error occurred';
			
			// Check for specific error patterns
			if (error && error.includes('the method eth_sendTransaction does not exist/is not available')) {
				error = 'Transaction failed: Your RPC provider does not support EIP-7702. We have configured Alchemy as the RPC provider for this demo, but your wallet may be using a different provider. Please check your wallet settings.';
			} else if (error && error.includes('user rejected')) {
				error = 'Transaction was rejected in your wallet.';
				addLog('Transaction was rejected by the user.');
			} else if (error && error.includes('authorization')) {
				error = 'EIP-7702 authorization failed. Please make sure your wallet supports EIP-7702.';
			} else if (error && error.includes('Account type "json-rpc" is not supported')) {
				error = 'Your wallet does not support the required account type for EIP-7702. We are trying a fallback approach that should work with most wallets.';
				addLog('Falling back to direct window.ethereum approach for EIP-7702...');
			} else if (error && (error.includes('delegation') || error.includes('eip7702'))) {
				error = 'Your wallet does not support EIP-7702 delegation. Please try a different wallet that supports this feature.';
			} else if (error && error.includes('signature')) {
				error = 'There was an issue with the EIP-7702 signature process. We are trying a fallback approach that should work with compatible wallets.';
			}
			
			addLog(`Error: ${error}`);
		} finally {
			isSubmitting = false;
		}
	}

	// Check if contract is deployed
	let isContractDeployed = false;

	onMount(async () => {
		if ($currentChainConfig.batchCallDelegationAddress !== ('0x0000000000000000000000000000000000000000' as `0x${string}`)) {
			isContractDeployed = true;
			addLog('Page loaded. Contract is deployed and ready to use.');
		} else {
			addLog('Page loaded. Contract is not yet deployed.');
		}
	});

	// Contract code as a string to avoid Svelte parsing issues
	const contractCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BatchCallDelegation {
  struct Call {
    bytes data;
    address to;
    uint256 value;
  }

  function execute(Call[] calldata calls) external payable {
    for (uint256 i = 0; i < calls.length; i++) {
      Call memory call = calls[i];
      (bool success, ) = call.to.call{value: call.value}(call.data);
      require(success, "call reverted");
    }
  }
}`;
</script>

<div class="flex flex-col items-center justify-center px-4 sm:px-6">
	<div class="w-full max-w-2xl rounded-lg border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
		<h1 class="mb-4 text-2xl font-medium text-gray-800">Batch Transfer</h1>

		<div class="prose prose-sm max-w-none text-gray-600">
			{#if !$walletStore.isConnected}
				<!-- Not connected state -->
				<div class="rounded-lg bg-gray-50 p-6 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8 text-gray-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							/>
						</svg>
					</div>
					<h3 class="mb-2 text-lg font-medium text-gray-700">Connect Wallet to Explore</h3>
				</div>
			{:else if !isCorrectChain}
				<!-- Wrong network state -->
				<div class="rounded-lg border border-yellow-100 bg-yellow-50 p-6 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8 text-yellow-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<h3 class="mb-2 text-lg font-medium text-gray-700">Switching Network...</h3>
					<p class="mb-4 text-gray-600">Please approve the network switch in your wallet</p>
					<button
						class="rounded-md bg-blue-400 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-blue-500"
						on:click={() => switchNetwork(currentChain === sepolia ? sepolia : holesky)}
					>
						Switch to {currentChain.name}
					</button>
				</div>
			{:else if !isContractDeployed}
				<!-- Contract not deployed state -->
				<div class="mb-6 rounded-md border border-gray-100 bg-gray-50 p-6">
					<p class="mb-2">The BatchCallDelegation contract has not been deployed yet.</p>
					<p>
						Please deploy the contract using Foundry and update the contract address in <code
							>src/lib/chainConfig.ts</code
						>.
					</p>
				</div>
			{:else}
				<!-- Connected and correct network state -->
				<div class="mb-6 border-b border-gray-200 pb-4">
					<h2 class="mb-2 text-lg font-medium text-gray-800">About This Demo</h2>
					<p class="mb-2">
						This demo showcases EIP-7702 batch transfer functionality using the 
						<a
							href="https://viem.sh/experimental/eip7702/contract-writes"
							target="_blank"
							rel="noopener noreferrer"
							class="text-blue-600 hover:underline"
						>
							BatchCallDelegation contract from viem docs' example
						</a>.
					</p>
					<p class="mb-2">
						The contract is deployed on {currentChain.name} at:
						<a 
							href="{currentChain.blockExplorers?.default.url}/address/{$currentChainConfig.batchCallDelegationAddress}"
							target="_blank"
							rel="noopener noreferrer"
							class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono hover:bg-gray-200 transition-colors"
						>{$currentChainConfig.batchCallDelegationAddress}</a>
					</p>

					<div class="mt-4">
						<h3 class="text-md mb-2 font-medium text-gray-700">How EIP-7702 Works in This Demo</h3>
						<p class="mb-2">
							EIP-7702 enables your regular wallet (EOA) to temporarily use smart contract
							functionality without deploying a contract. Here's how it works:
						</p>
						<ol class="mb-3 list-decimal space-y-2 pl-5">
							<li>
								<strong>Authorization:</strong> When you click "Send Batch Transfer", your wallet first
								signs an authorization message that permits the BatchCallDelegation contract to act as
								an interface for your EOA.
							</li>
							<li>
								<strong>Transaction Creation:</strong> The signed authorization is included with your
								transaction data, which contains instructions for multiple transfers.
							</li>
							<li>
								<strong>Execution:</strong> When the transaction is processed, the EVM temporarily injects
								the BatchCallDelegation contract's code into your EOA's context.
							</li>
							<li>
								<strong>Batch Processing:</strong> The contract's <span class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">execute()</span> function runs within your
								EOA's context, processing all transfers in a single atomic transaction. Importantly, you're actually calling <span class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">execute()</span> on your own account address, not on the contract address.
							</li>
							<li>
								<strong>Completion:</strong> After execution, your EOA returns to normal, but the transfers
								have been completed in one transaction, saving gas and ensuring atomicity.
							</li>
						</ol>
					</div>

					<!-- Warning about RPC provider compatibility -->
					<div class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-600">
						EIP-7702 requires a compatible RPC provider and wallet. This demo uses Alchemy, but your wallet might override this. You'll need to approve two requests: first to sign the authorization, then to send the transaction.
					</div>

					<!-- Collapsible contract code section -->
					<div class="mt-4 border-t border-gray-100 pt-3">
						<button
							class="group flex items-center text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
							on:click={toggleContractCode}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="mr-1 h-4 w-4 transition-transform duration-200 {showContractCode
									? 'rotate-90'
									: ''}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
							<span class="group-hover:underline">View Contract Code</span>
						</button>

						{#if showContractCode}
							<div class="mt-3 overflow-hidden rounded-md border border-gray-200">
								<div class="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-4 py-2">
									<span class="text-xs font-medium text-gray-600">BatchCallDelegation.sol</span>
									<button 
										class="text-xs flex items-center text-gray-600 hover:text-gray-800 focus:outline-none"
										on:click={() => {
											navigator.clipboard.writeText(contractCode);
											// Silent operation - no log
										}}
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
											<path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
											<path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
										</svg>
										Copy
									</button>
								</div>
								<div class="bg-gray-900 p-4 overflow-x-auto">
									<pre class="text-xs text-gray-200 font-mono">{contractCode}</pre>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<form on:submit|preventDefault={submitBatchTransfer} class="space-y-6">
					<div class="space-y-4">
						{#each recipients as _, index}
							<div class="flex space-x-2">
								<div class="flex-1">
									<label
										for={`recipient-${index}`}
										class="mb-1 block text-sm font-medium text-gray-700"
									>
										Recipient Address
									</label>
									<input
										id={`recipient-${index}`}
										type="text"
										bind:value={recipients[index]}
										placeholder="0x..."
										class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
										disabled={isSubmitting}
									/>
								</div>
								<div class="w-1/3">
									<label
										for={`amount-${index}`}
										class="mb-1 block text-sm font-medium text-gray-700"
									>
										Amount (ETH)
									</label>
									<input
										id={`amount-${index}`}
										type="text"
										bind:value={amounts[index]}
										placeholder="0.01"
										class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
										disabled={isSubmitting}
									/>
								</div>
								{#if recipients.length > 2}
									<div class="flex items-end">
										<button
											type="button"
											on:click={() => removeRecipient(index)}
											class="mb-0.5 p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
											disabled={isSubmitting}
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fill-rule="evenodd"
													d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
													clip-rule="evenodd"
												/>
											</svg>
										</button>
									</div>
								{:else}
									<div class="w-9"></div>
									<!-- Spacer to maintain layout when no delete button -->
								{/if}
							</div>
						{/each}
					</div>

					<div>
						<button
							type="button"
							on:click={addRecipient}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
							disabled={isSubmitting}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="mr-2 -ml-0.5 h-4 w-4"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
									clip-rule="evenodd"
								/>
							</svg>
							Add Recipient
						</button>
					</div>

					{#if error}
						<div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
							{error}
						</div>
					{/if}

					{#if txHash}
						<div class="rounded-md border border-green-100 bg-green-50 p-3 text-sm text-green-700">
							Transaction submitted! Hash: <a
								href={`https://sepolia.etherscan.io/tx/${txHash}`}
								target="_blank"
								rel="noopener noreferrer"
								class="underline">{txHash}</a
							>
						</div>
					{/if}

					<div>
						<button
							type="submit"
							class="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
							disabled={isSubmitting}
						>
							{#if isSubmitting}
								<svg
									class="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								Processing...
							{:else}
								Send Batch Transfer
							{/if}
						</button>
					</div>
				</form>

				<!-- Log section -->
				<div class="mt-8 border-t border-gray-200 pt-6">
					<h3 class="mb-3 text-lg font-medium text-gray-800">Activity Log</h3>
					<div class="h-48 overflow-y-auto rounded-md bg-gray-50 p-3 font-mono text-sm">
						{#if logs.length === 0}
							<p class="text-gray-500 italic">No activity yet</p>
						{:else}
							{#each logs as log}
								<div class="mb-1 text-gray-700">{log}</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
