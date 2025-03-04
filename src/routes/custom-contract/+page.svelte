<script lang="ts">
	import { walletStore, connectWallet } from '$lib/wallet';
	import { sepolia, holesky } from 'viem/chains';
	import { chainConfigs, currentChainConfig } from '$lib/chainConfig';
	import { parseEther, type Address, custom } from 'viem';
	import { onMount } from 'svelte';
	import PrivateKeyInput from '$lib/components/PrivateKeyInput.svelte';
	import SigningModal from '$lib/components/SigningModal.svelte';
	import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem';
	import { privateKeyToAccount } from 'viem/accounts';
	import { eip7702Actions } from 'viem/experimental';

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

	// State for custom contract form
	let contractAddress: string = '';
	let authorizationSigned: string = '';
	let isSubmitting = false;
	let error: string | null = null;
	let logs: string[] = [];
	let signedAuthorizationData: any = null;

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
		
		const timestamp = new Date().toLocaleTimeString();
		logs = [`[${timestamp}] ${logMessage}`, ...logs];
		if (logs.length > 50) logs = logs.slice(0, 50);
	}
	
	// Format step names to be more descriptive
	function formatStepName(step: string): string {
		switch (step) {
			case 'preparing':
				return 'Preparing Authorization';
			case 'authorization':
				return 'Authorization Signing';
			case 'signing':
				return 'Signing Authorization';
			case 'complete':
				return 'Authorization Complete';
			case 'data':
				return '📝 Authorization Data';
			case 'error':
				return '❌ Error';
			case 'Validation error':
				return '❌ Validation Error';
			default:
				return step.charAt(0).toUpperCase() + step.slice(1);
		}
	}

	// Copy the authorization to clipboard
	async function copyAuthorizationToClipboard() {
		try {
			if (signedAuthorizationData) {
				const dataToCopy = JSON.stringify(prepareDataForDisplay(signedAuthorizationData), null, 2);
				console.log('Copying to clipboard:', dataToCopy);
				await navigator.clipboard.writeText(dataToCopy);
				addLog('Authorization copied to clipboard');
			}
		} catch (error) {
			console.error('Error copying to clipboard:', error);
			addLog('Error copying to clipboard');
		}
	}

	// Copy just the raw authorization data to clipboard
	async function copyRawAuthorizationToClipboard() {
		try {
			if (signedAuthorizationData?.authorization) {
				const rawData = JSON.stringify(prepareDataForDisplay(signedAuthorizationData.authorization), null, 2);
				console.log('Copying raw data to clipboard:', rawData);
				await navigator.clipboard.writeText(rawData);
				addLog('Raw authorization data copied to clipboard');
			}
		} catch (error) {
			console.error('Error copying to clipboard:', error);
			addLog('Error copying raw authorization to clipboard');
		}
	}

	// Validate contract address
	function isValidAddress(address: string): boolean {
		// Check if address is a valid Ethereum address
		return /^0x[a-fA-F0-9]{40}$/.test(address);
	}

	// Sign the authorization
	async function signAuthorization(event: Event) {
		event.preventDefault();
		if (isSubmitting) return;

		try {
			isSubmitting = true;
			error = null;
			authorizationSigned = '';
			signedAuthorizationData = null;
			logs = [];
			
			// Validate contract address
			if (!contractAddress || !isValidAddress(contractAddress)) {
				throw new Error('Please enter a valid contract address');
			}

			// Check if wallet is connected
			if (!$walletStore.isConnected || !$walletStore.address) {
				throw new Error('Please connect your wallet');
			}

			addLog('preparing', 'Preparing to sign authorization for contract');

			// Create a wallet client (using MetaMask or private key)
			let account;
			let walletClient;

			if ($walletStore.isPrivateKeyAccount && $walletStore.privateKey) {
				addLog('preparing', 'Using private key account');
				account = privateKeyToAccount($walletStore.privateKey);
				walletClient = createWalletClient({
					account,
					chain: currentChain,
					transport: http($currentChainConfig.rpcUrl)
				}).extend(eip7702Actions());
			} else {
				addLog('preparing', 'Using browser wallet');
				if (!window.ethereum) {
					throw new Error('No browser wallet detected');
				}
				walletClient = createWalletClient({
					account: $walletStore.address as Address,
					chain: currentChain,
					transport: custom(window.ethereum)
				}).extend(eip7702Actions());
			}

			addLog('signing', 'Creating authorization for contract ' + contractAddress);
			
			try {
				// Use the signAuthorization method from the extended wallet client
				const authorizationResult = await walletClient.signAuthorization({
					contractAddress: contractAddress as Address
				});
				
				// Log the authorization result for debugging (only to console, not to UI logs)
				console.log('Authorization result:', authorizationResult);
				addLog('authorization', 'Received authorization data from wallet');
				
				// Store the raw authorization data - use prepareDataForDisplay to handle BigInt
				authorizationSigned = JSON.stringify(prepareDataForDisplay(authorizationResult), null, 2);
				
				// Create a simplified version of the authorization data for logs
				const authSummary = {
					contractAddress: contractAddress,
					chain: currentChain.name,
					account: $walletStore.address,
					signature: authorizationResult.signature?.substring(0, 20) + '...' // Show just the beginning of the signature
				};
				
				// Add the authorization data to logs
				addLog('data', 'Authorization signed with data: ' + JSON.stringify(authSummary));
				
				// Create the example transaction structure
				const exampleTransaction = {
					contract: contractAddress,
					function: "execute", // Example function
					calls: [
						{
							to: "0x000000000000000000000000000000000000dEaD",
							value: "10000000000000000", // 0.01 ETH
							data: "0x"
						},
						{
							to: "0x6987E30398b2896B5118ad1076fb9f58825a6f1a",
							value: "10000000000000000", // 0.01 ETH
							data: "0x"
						}
					],
					totalValue: "20000000000000000", // 0.02 ETH
					chainId: currentChain.id,
					from: $walletStore.address,
					eip7702: {
						contractAddress: contractAddress,
						authorization: authorizationResult
					}
				};
				
				// Store the example transaction
				signedAuthorizationData = exampleTransaction;
				
				addLog('complete', 'Authorization successfully signed');
			} catch (error: any) {
				console.error('Error signing authorization:', error);
				addLog('error', error.message || 'Error signing authorization');
				throw error;
			}
		} catch (error: any) {
			console.error('Error:', error);
			error = error.message || 'An unexpected error occurred';
			addLog('error', error);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-5xl">
	<h1 class="text-3xl font-bold mb-6">Custom Contract Authorization</h1>
	
	<!-- Emergency Debug Display -->
	
	<!-- Warning Section - REMOVED -->
	
	<!-- Form Section -->
	<div class="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
		<div class="p-6">
			<h2 class="text-xl font-semibold mb-4">Sign Authorization</h2>
			
			<form on:submit={signAuthorization} class="space-y-4">
				<!-- Contract Address Input -->
				<div>
					<label for="contractAddress" class="block text-sm font-medium text-gray-700 mb-1">
						Contract Address
					</label>
					<input
						type="text"
						id="contractAddress"
						bind:value={contractAddress}
						placeholder="0x..."
						class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
					/>
					<p class="mt-1 text-sm text-gray-500">Enter the contract address you want to authorize</p>
				</div>
				
				<!-- Network Warning -->
				{#if $walletStore.isConnected && !isCorrectChain}
					<div class="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
						⚠️ You are connected to the wrong network. Please switch to {currentChain.name}.
					</div>
				{/if}
				
				<!-- Submit Button -->
				<div class="flex justify-end mt-4">
					<button
						type="submit"
						disabled={isSubmitting || !$walletStore.isConnected || !isCorrectChain}
						class="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						{isSubmitting ? 'Signing...' : 'Sign Authorization'}
					</button>
				</div>
				
				<!-- Error Message -->
				{#if error}
					<div class="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm mt-4">
						{error}
					</div>
				{/if}
			</form>
		</div>
	</div>
	
	<!-- Raw Authorization Data -->
	{#if authorizationSigned}
		<div class="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
			<div class="p-6">
				<h2 class="text-xl font-semibold mb-4 flex justify-between items-center">
					<span>Authorization Data</span>
					<button
						on:click={() => {
							navigator.clipboard.writeText(authorizationSigned);
							addLog('Authorization data copied to clipboard');
						}}
						class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
					>
						Copy Data
					</button>
				</h2>
				
				<div class="bg-gray-50 rounded-md p-4 font-mono text-sm overflow-x-auto">
					<pre>{authorizationSigned}</pre>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Example Transaction Structure -->
	
	<!-- Logs Section -->
	<div class="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
		<div class="p-6">
			<h2 class="text-xl font-semibold mb-4">Logs</h2>
			<div class="bg-gray-50 rounded-md p-4 font-mono text-xs h-64 overflow-y-auto">
				{#if logs.length === 0}
					<p class="text-gray-500 italic">No logs yet...</p>
				{:else}
					{#each logs as log}
						<div class="mb-1">{log}</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Signing Modal -->
<SigningModal
	show={showSigningModal}
	title={signingTitle}
	message={signingMessage}
	data={signingData}
	onConfirm={onSignConfirm}
	onCancel={onSignCancel}
/> 