<script lang="ts">
	import { walletStore, connectWallet } from '$lib/wallet';
	import { sepolia, holesky } from 'viem/chains';
	import { batchTransfer } from '$lib/batchTransfer';
	import { chainConfigs, currentChainConfig } from '$lib/chainConfig';
	import { parseEther, type Address } from 'viem';
	import { onMount } from 'svelte';
	import PrivateKeyInput from '$lib/components/PrivateKeyInput.svelte';
	import SigningModal from '$lib/components/SigningModal.svelte';

	// Get current chain from config
	$: currentChain = $currentChainConfig.chain;
	$: isCorrectChain =
		$walletStore.isConnected && window?.ethereum?.chainId === `0x${currentChain.id.toString(16)}`;

	// State for warning dropdown
	let isWarningExpanded = true;

	// State for signing modal
	let showSigningModal = false;
	let signingTitle = '';
	let signingMessage = '';
	let signingData = '';
	let onSignConfirm: () => Promise<void> = async () => {};
	let onSignCancel: () => void = () => {};

	// Function to handle signing requests
	async function handleSigningRequest(confirmation: {
		title: string;
		message: string;
		data: string;
		onConfirm: () => Promise<void>;
		onCancel: () => void;
	}) {
		signingTitle = confirmation.title;
		signingMessage = confirmation.message;
		signingData = confirmation.data;
		onSignConfirm = confirmation.onConfirm;
		onSignCancel = confirmation.onCancel;
		showSigningModal = true;

		return new Promise<void>((resolve, reject) => {
			onSignConfirm = async () => {
				try {
					await confirmation.onConfirm();
					showSigningModal = false;
					resolve();
				} catch (error) {
					reject(error);
				}
			};
			onSignCancel = () => {
				showSigningModal = false;
				confirmation.onCancel();
				reject(new Error('User rejected signing'));
			};
		});
	}

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
				.catch((switchError: { code: number }) => {
					// This error code indicates that the chain has not been added to MetaMask.
					if (switchError.code === 4902) {
						window.ethereum.request({
							method: 'wallet_addEthereumChain',
							params: [
								{
									chainId: `0x${targetChain.id.toString(16)}`,
									chainName: targetChain.name,
									rpcUrls: [targetChain === holesky ? 
										`https://eth-holesky.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}` : 
										`https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`],
									nativeCurrency: {
										name: 'ETH',
										symbol: 'ETH',
										decimals: 18
									},
									blockExplorerUrls: [targetChain.blockExplorers?.default.url]
								}
							]
						}).catch(console.error);
					} else {
						console.error(switchError);
					}
				});
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
	function addLog(stepOrMessage: string, message?: string): void {
		let logMessage: string;
		
		if (message) {
			// Called with step and message (from progress callback)
			// Format step to be more descriptive
			const stepFormatted = formatStepName(stepOrMessage);
			logMessage = `${stepFormatted}: ${message}`;
		} else {
			// Called with just a message
			logMessage = stepOrMessage;
		}
		
		// Skip logging for filtered messages
		if (filteredLogMessages.some(filter => logMessage.includes(filter))) {
			return;
		}
		
		const timestamp = new Date().toLocaleTimeString();
		logs = [`[${timestamp}] ${logMessage}`, ...logs];
		if (logs.length > 50) logs = logs.slice(0, 50);
	}
	
	// Format step names to be more descriptive
	function formatStepName(step: string): string {
		switch (step) {
			case 'preparing':
				return 'Preparing Transaction';
			case 'authorization':
				return 'Authorization Signing';
			case 'transaction':
				return 'Submitting Transaction';
			case 'transaction_retry':
				return 'Retrying Transaction';
			case 'transaction_complete':
				return 'Transaction Complete';
			case 'error':
				return '❌ Error';
			case 'Validation error':
				return '❌ Validation Error';
			default:
				return step.charAt(0).toUpperCase() + step.slice(1);
		}
	}

	// Toggle contract code visibility
	function toggleContractCode() {
		showContractCode = !showContractCode;
		// Silent operation - no log
	}

	// Submit the batch transfer
	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (isSubmitting) return;

		try {
			isSubmitting = true;
			error = null;
			txHash = null;

			// Validate recipients and amounts
			const validRecipients = recipients.filter((r) => r !== '');
			const validAmounts = amounts.filter((_, i) => recipients[i] !== '');

			if (validRecipients.length < 2) {
				const errorMsg = 'At least 2 valid recipient addresses are required for batch transfers. Please add more recipients.';
				addLog('Validation error', errorMsg);
				throw new Error(errorMsg);
			}

			if (validRecipients.length !== validAmounts.length) {
				const errorMsg = 'Each recipient must have a valid amount. Please check all fields.';
				addLog('Validation error', errorMsg);
				throw new Error(errorMsg);
			}

			// Format the transfers array
			const transfers = validRecipients.map((to, i) => ({
				to: to as Address,
				value: parseEther(validAmounts[i])
			}));

			// Execute the batch transfer with signing confirmation
			txHash = await batchTransfer(transfers, addLog, handleSigningRequest);
		} catch (err) {
			if (err instanceof Error) {
				if (err.message === 'User rejected signing') {
					error = 'Transaction was cancelled by user.';
					addLog('Transaction was cancelled by user.');
				} else if (err.message.includes('rejected')) {
					error = 'Transaction was rejected in your wallet.';
					addLog('Transaction was rejected by the user.');
				} else if (err.message.includes('authorization')) {
					error = 'EIP-7702 authorization failed. Please make sure your wallet supports EIP-7702.';
				} else if (err.message.includes('Account type "json-rpc" is not supported')) {
					error = 'Your wallet does not support the required account type for EIP-7702. We are trying a fallback approach that should work with most wallets.';
					addLog('Falling back to direct window.ethereum approach for EIP-7702...');
				} else if (err.message.includes('delegation') || err.message.includes('eip7702')) {
					error = 'Your wallet does not support EIP-7702 delegation. Please try a different wallet that supports this feature.';
				} else if (err.message.includes('signature')) {
					error = 'There was an issue with the EIP-7702 signature process. We are trying a fallback approach that should work with compatible wallets.';
				} else {
					error = err.message;
					addLog('Error', err.message);
				}
			} else {
				error = 'An unknown error occurred';
				addLog('Error', 'An unknown error occurred');
			}
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
		<h1 class="mb-4 text-2xl font-medium text-gray-800">Batch Transfer Example</h1>

		<div class="prose prose-sm max-w-none text-gray-600">
			{#if $walletStore.isConnected && !$walletStore.isPrivateKeyAccount}
				<!-- Warning banner for connected wallets -->
				<div class="mb-6 bg-amber-50 px-3 py-2 rounded-md inline-flex items-start w-full">
					<div class="flex-shrink-0 mt-0.5">
						<svg class="h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path fill-rule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-2 flex-grow">
						<button 
							class="inline-flex items-center focus:outline-none"
							on:click={() => isWarningExpanded = !isWarningExpanded}
						>
							<span class="text-sm font-medium text-amber-800">Limited Browser Wallet Support</span>
							<svg 
								class="h-4 w-4 ml-1 text-amber-500 transition-transform duration-200 {isWarningExpanded ? 'rotate-180' : ''}" 
								xmlns="http://www.w3.org/2000/svg" 
								viewBox="0 0 20 20" 
								fill="currentColor"
							>
								<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
							</svg>
						</button>
						
						{#if isWarningExpanded}
							<div class="mt-1 text-sm text-amber-700 transition-all duration-300">
								<p>
									EIP-7702 support in wallets is still emerging. Your current wallet might not fully support this experimental feature.
									You can <button 
										on:click={() => {
											// Disconnect current wallet
											walletStore.update(state => ({...state, address: null, isConnected: false}));
										}}
										class="font-medium text-amber-800 underline hover:text-amber-900"
									>use a private key instead</button> to guarantee compatibility for testing.
								</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
			
			{#if !$walletStore.isConnected}
				<!-- Not connected state -->
				<div class="rounded-lg bg-gray-50 p-6">
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<!-- Regular wallet connection -->
						<div class="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
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
							<h3 class="mb-2 text-lg font-medium text-gray-700 text-center">Connect Wallet</h3>
							<p class="text-sm text-gray-600 text-center mb-4">
								Connect with MetaMask or another web3 wallet
							</p>
							<button
								class="w-full flex justify-center items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
								on:click={() => connectWallet()}
							>
								Connect Wallet
							</button>
						</div>

						<!-- Private key input -->
						<PrivateKeyInput />
					</div>
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
					<div class="mt-4 bg-amber-50 px-3 py-2 rounded-md inline-flex items-start w-full">
						<div class="flex-shrink-0 mt-0.5">
							<svg class="h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<path fill-rule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
							</svg>
						</div>
						<div class="ml-2 flex-grow">
							<span class="text-xs text-amber-700">
								EIP-7702 requires a compatible RPC provider and wallet. This demo uses Alchemy, but your wallet might override this.
							</span>
						</div>
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

				<form on:submit|preventDefault={handleSubmit} class="space-y-6">
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
								href={`${currentChain.blockExplorers?.default.url}/tx/${txHash}`}
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

<!-- Add the SigningModal component -->
<SigningModal
	show={showSigningModal}
	title={signingTitle}
	message={signingMessage}
	data={signingData}
	onConfirm={onSignConfirm}
	onCancel={onSignCancel}
/>
