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
					r: authorizationResult.r?.substring(0, 10) + '...',
					s: authorizationResult.s?.substring(0, 10) + '...',
					v: authorizationResult.v?.toString()
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

	// State for custom EIP-7702 transaction
	let pastedAuthorization: string = '';
	let transactionError: string | null = null;
	let isProcessingTransaction = false;
	
	// Etherscan API related state
	let contractAbi: any[] = [];
	let contractFunctions: any[] = [];
	let selectedFunction: string = '';
	let isLoadingAbi: boolean = false;
	let abiError: string | null = null;
	let parsedAuthorization: any = null;
	
	// Function input values state
	let functionInputValues: { [key: string]: string } = {};
	
	// Transaction modal state
	let showTransactionModal = false;
	let builtTransaction: any = null;
	let isSendingTransaction = false;
	let transactionHash: string | null = null;
	let transactionStatus: 'pending' | 'confirmed' | 'failed' | null = null;
	let transactionValue = '0'; // New variable for transaction value input

	// Function to paste authorization from above section
	function pasteAuthorizationFromAbove() {
		if (authorizationSigned) {
			pastedAuthorization = authorizationSigned;
			addLog('Transaction', 'Pasted authorization from above section');
			parseAuthorizationAndFetchAbi();
		}
	}
	
	// Parse the pasted authorization and extract contract address
	async function parseAuthorizationAndFetchAbi() {
		try {
			abiError = null;
			contractAbi = [];
			contractFunctions = [];
			selectedFunction = '';
			functionInputValues = {};
			
			if (!pastedAuthorization) {
				return;
			}
			
			// Parse the authorization JSON
			parsedAuthorization = JSON.parse(pastedAuthorization);
			
			// Extract contract address - handle different possible formats
			let extractedContractAddress: string | undefined;
			
			if (parsedAuthorization.eip7702?.contractAddress) {
				// Format from our example transaction
				extractedContractAddress = parsedAuthorization.eip7702.contractAddress;
			} else if (parsedAuthorization.contractAddress) {
				// Direct format with contractAddress at root
				extractedContractAddress = parsedAuthorization.contractAddress;
			} else if (parsedAuthorization.contract) {
				// Alternative format with contract field
				extractedContractAddress = parsedAuthorization.contract;
			}
			
			if (!extractedContractAddress || !isValidAddress(extractedContractAddress)) {
				throw new Error('Could not find a valid contract address in the pasted authorization');
			}
			
			addLog('Contract', `Found contract address: ${extractedContractAddress}`);
			
			// Fetch the contract ABI from Etherscan
			await fetchContractAbi(extractedContractAddress);
			
		} catch (error: any) {
			console.error('Error parsing authorization:', error);
			abiError = error.message || 'Failed to parse authorization data';
			addLog('error', abiError || 'Unknown error parsing authorization');
		}
	}

	// Watch for changes in the selected function to reset input values
	$: if (selectedFunction) {
		// Reset input values when function changes
		functionInputValues = {};
	}

	// Function to handle input value changes
	function handleInputChange(index: number, value: string) {
		functionInputValues[index.toString()] = value;
	}

	// Function to determine if a function is payable
	function isPayableFunction(funcDetails: any): boolean {
		return funcDetails && funcDetails.stateMutability === 'payable';
	}

	// Function to build the transaction
	async function buildTransaction(event: Event) {
		event.preventDefault();
		if (isProcessingTransaction) return;

		try {
			isProcessingTransaction = true;
			transactionError = null;
			builtTransaction = null;
			addLog('Transaction', 'Building EIP-7702 transaction');
			
			// Validate pasted authorization
			if (!pastedAuthorization) {
				throw new Error('Please paste a signed authorization');
			}

			// Validate selected function
			if (!selectedFunction) {
				throw new Error('Please select a function to call');
			}

			// Get the selected function details
			const selectedFunctionDetails = contractFunctions.find(f => f.name === selectedFunction);
			if (!selectedFunctionDetails) {
				throw new Error('Selected function not found in ABI');
			}

			// Extract contract address from authorization
			let contractAddress: string;
			if (parsedAuthorization.eip7702?.contractAddress) {
				contractAddress = parsedAuthorization.eip7702.contractAddress;
			} else if (parsedAuthorization.contractAddress) {
				contractAddress = parsedAuthorization.contractAddress;
			} else if (parsedAuthorization.contract) {
				contractAddress = parsedAuthorization.contract;
			} else {
				throw new Error('Contract address not found in authorization');
			}

			// Extract authorization data
			let authorization: any;
			if (parsedAuthorization.eip7702?.authorization) {
				authorization = parsedAuthorization.eip7702.authorization;
			} else if (parsedAuthorization.authorization) {
				authorization = parsedAuthorization.authorization;
			} else {
				// If the entire object is the authorization
				authorization = parsedAuthorization;
			}

			// Prepare function arguments
			const functionArgs = [];
			let callsArray = [];
			let totalValue = BigInt(0);
			
			// If the function is payable, use the transaction value
			if (selectedFunctionDetails && isPayableFunction(selectedFunctionDetails)) {
				// Convert the input value to BigInt
				try {
					totalValue = transactionValue ? BigInt(parseFloat(transactionValue) * 1e18) : BigInt(0);
					addLog('info', `Setting transaction value to ${transactionValue} ETH (${totalValue} wei)`);
				} catch (error: any) {
					throw new Error(`Invalid transaction value: ${error.message}`);
				}
			}
			
			for (let i = 0; i < selectedFunctionDetails.inputs.length; i++) {
				const input = selectedFunctionDetails.inputs[i];
				const value = functionInputValues[i.toString()] || '';
				
				if (!value && input.type !== 'bool') {
					throw new Error(`Missing value for parameter: ${input.name} (${input.type})`);
				}
				
				// Convert the value based on its type
				let convertedValue;
				
				if (input.type.includes('tuple[]')) {
					// Handle array of tuples
					try {
						// Parse the JSON array of objects
						const arrayData = JSON.parse(value);
						if (!Array.isArray(arrayData)) {
							throw new Error(`Invalid array format for parameter: ${input.name}`);
						}
						
						// Process each tuple in the array
						convertedValue = arrayData.map(item => {
							// Convert each field in the tuple based on its type
							const result: Record<string, any> = {};
							if (input.components) {
								for (const component of input.components) {
									const componentValue = item[component.name];
									if (componentValue === undefined) {
										throw new Error(`Missing value for ${component.name} in tuple array item`);
									}
									
									// Convert based on component type
									if (component.type.includes('uint') || component.type.includes('int')) {
										result[component.name] = BigInt(componentValue);
									} else if (component.type === 'bool') {
										result[component.name] = componentValue === true || componentValue === 'true';
									} else {
										result[component.name] = componentValue;
									}
								}
							}
							return result;
						});
						
						// If this is a "calls" parameter for the execute function, save it separately
						if (input.name === 'calls' && selectedFunction === 'execute') {
							callsArray = arrayData;
							
							// Calculate total value from calls
							if (Array.isArray(callsArray)) {
								totalValue = callsArray.reduce((sum, call) => {
									if (call.value) {
										return sum + BigInt(call.value);
									}
									return sum;
								}, BigInt(0));
							}
						}
					} catch (error: any) {
						console.error('Error processing tuple array:', error);
						throw new Error(`Invalid format for tuple array parameter: ${input.name}. ${error.message}`);
					}
				} else if (input.type.includes('tuple')) {
					// Handle single tuple/struct
					try {
						const tupleData = JSON.parse(value);
						const result: Record<string, any> = {};
						
						if (input.components) {
							for (const component of input.components) {
								const componentValue = tupleData[component.name];
								if (componentValue === undefined) {
									throw new Error(`Missing value for ${component.name} in tuple`);
								}
								
								// Convert based on component type
								if (component.type.includes('uint') || component.type.includes('int')) {
									result[component.name] = BigInt(componentValue);
								} else if (component.type === 'bool') {
									result[component.name] = componentValue === true || componentValue === 'true';
								} else {
									result[component.name] = componentValue;
								}
							}
						}
						
						convertedValue = result;
					} catch (error: any) {
						console.error('Error processing tuple:', error);
						throw new Error(`Invalid format for tuple parameter: ${input.name}. ${error.message}`);
					}
				} else if (input.type.includes('uint')) {
					// Handle uint types
					if (value.includes('e')) {
						// Scientific notation
						convertedValue = BigInt(Math.floor(Number(value)));
					} else {
						convertedValue = BigInt(value);
					}
				} else if (input.type.includes('int')) {
					// Handle int types
					convertedValue = BigInt(value);
				} else if (input.type === 'bool') {
					// Handle boolean
					convertedValue = value === 'true';
				} else if (input.type === 'address') {
					// Handle address
					if (!isValidAddress(value)) {
						throw new Error(`Invalid Ethereum address for parameter: ${input.name}`);
					}
					convertedValue = value;
				} else if (input.type.includes('bytes')) {
					// Handle bytes
					if (!value.startsWith('0x')) {
						throw new Error(`Bytes value must start with 0x for parameter: ${input.name}`);
					}
					convertedValue = value;
				} else if (input.type.includes('[]')) {
					// Handle arrays
					try {
						convertedValue = value.split(',').map(item => item.trim());
						
						// Further conversion based on array element type
						const baseType = input.type.replace('[]', '');
						if (baseType.includes('uint') || baseType.includes('int')) {
							convertedValue = convertedValue.map(item => BigInt(item));
						} else if (baseType === 'bool') {
							convertedValue = convertedValue.map(item => item === 'true');
						} else if (baseType === 'address') {
							convertedValue.forEach(item => {
								if (!isValidAddress(item)) {
									throw new Error(`Invalid Ethereum address in array: ${item}`);
								}
							});
						}
					} catch (error: any) {
						throw new Error(`Invalid array format for parameter: ${input.name}. ${error.message}`);
					}
				} else {
					// Default case (strings, etc.)
					convertedValue = value;
				}
				
				functionArgs.push(convertedValue);
			}

			// Log the function arguments for debugging
			console.log('Function arguments:', functionArgs);

			// Encode function data
			let functionData;
			try {
				functionData = encodeFunctionData({
					abi: [selectedFunctionDetails],
					functionName: selectedFunction,
					args: functionArgs
				});
			} catch (error: any) {
				console.error('Error encoding function data:', error);
				throw new Error(`Failed to encode function data: ${error.message}`);
			}

			// Build the EIP-7702 transaction using the specified structure
			const transaction = {
				contract: contractAddress,
				function: selectedFunction,
				calls: callsArray,
				totalValue: totalValue.toString(),
				chainId: currentChain.id,
				from: parsedAuthorization.account || $walletStore.address,
				eip7702: {
					contractAddress: contractAddress,
					authorization: authorization
				}
			};

			// Store the built transaction
			builtTransaction = prepareDataForDisplay(transaction);
			
			addLog('success', 'Transaction built successfully');
			
			// Show the transaction modal
			showTransactionModal = true;
			
		} catch (error: any) {
			console.error('Transaction error:', error);
			transactionError = error.message || 'An unexpected error occurred';
			addLog('error', error.message || 'Transaction error');
		} finally {
			isProcessingTransaction = false;
		}
	}

	// Function to close the transaction modal
	function closeTransactionModal() {
		showTransactionModal = false;
		// Reset transaction status when closing the modal
		transactionHash = null;
		transactionStatus = null;
	}

	// Function to copy the built transaction to clipboard
	async function copyTransactionToClipboard() {
		try {
			if (builtTransaction) {
				const dataToCopy = JSON.stringify(builtTransaction, null, 2);
				await navigator.clipboard.writeText(dataToCopy);
				addLog('Transaction copied to clipboard');
			}
		} catch (error) {
			console.error('Error copying to clipboard:', error);
			addLog('Error copying transaction to clipboard');
		}
	}

	// Function to send the transaction
	async function sendTransaction() {
		if (isSendingTransaction || !builtTransaction) return;
		
		try {
			isSendingTransaction = true;
			transactionHash = null;
			transactionStatus = null;
			addLog('Transaction', 'Preparing to send EIP-7702 transaction');
			
			// Create a wallet client based on the current connection
			let walletClient;
			
			if ($walletStore.isPrivateKeyAccount && $walletStore.privateKey) {
				addLog('Transaction', 'Using private key account');
				const account = privateKeyToAccount($walletStore.privateKey);
				walletClient = createWalletClient({
					account,
					chain: currentChain,
					transport: http($currentChainConfig.rpcUrl)
				}).extend(eip7702Actions());
			} else {
				addLog('Transaction', 'Using browser wallet');
				if (!window.ethereum) {
					throw new Error('No browser wallet detected');
				}
				walletClient = createWalletClient({
					account: $walletStore.address as Address,
					chain: currentChain,
					transport: custom(window.ethereum)
				}).extend(eip7702Actions());
			}
			
			// Get the contract ABI for the selected function
			const selectedFunctionDetails = contractFunctions.find(f => f.name === selectedFunction);
			if (!selectedFunctionDetails) {
				throw new Error('Selected function not found in ABI');
			}
			
			// Extract function-specific details
			let args = [];
			if (selectedFunction === 'execute' && builtTransaction.calls) {
				args = [builtTransaction.calls]; // For execute function, args is an array with the calls array inside
			} else {
				// For other functions, extract arguments based on function inputs
				// This would need custom handling for each function type
				// Not implementing this here as you specifically mentioned the execute function
			}
			
			// Create an authorization object in the format viem expects
			const authorization = builtTransaction.eip7702.authorization;
			
			// Log the details for debugging
			console.log('Sending with args:', args);
			console.log('Using authorization:', authorization);
			
			// Prepare the transaction using viem's writeContract as shown in the documentation
			addLog('Transaction', 'Preparing contract write transaction');
			
			const hash = await walletClient.writeContract({
				abi: [selectedFunctionDetails],
				address: $walletStore.address as Address,
				functionName: selectedFunction,
				args: args,
				value: BigInt(builtTransaction.totalValue || 0),
				authorizationList: [authorization],
			});
			
			transactionHash = hash;
			addLog('success', `Transaction sent! Hash: ${hash}`);
			
			// Set status to pending
			transactionStatus = 'pending';
			
		} catch (error: any) {
			console.error('Error sending transaction:', error);
			transactionStatus = 'failed';
			
			// Extract more detailed error information
			let errorMessage = error.message || 'Unknown error';
			let detailedError = '';
			
			// Check for common error patterns
			if (errorMessage.includes('execution reverted')) {
				// Extract revert reason if available
				const revertMatch = errorMessage.match(/execution reverted: (.*?)($|\.)/);
				if (revertMatch && revertMatch[1]) {
					detailedError = `Contract reverted: ${revertMatch[1]}`;
				} else {
					detailedError = 'Contract execution reverted without a reason';
				}
			} else if (errorMessage.includes('insufficient funds')) {
				detailedError = 'Insufficient funds for gas * price + value';
			} else if (errorMessage.includes('nonce')) {
				detailedError = 'Nonce issue: transaction may be pending or already processed';
			} else if (errorMessage.includes('gas')) {
				detailedError = 'Gas estimation failed or gas limit exceeded';
			} else {
				detailedError = errorMessage;
			}
			
			addLog('error', `Transaction failed: ${detailedError}`);
		} finally {
			isSendingTransaction = false;
		}
	}

	// Fetch contract ABI from Etherscan
	async function fetchContractAbi(address: string) {
		isLoadingAbi = true;
		abiError = null;
		
		try {
			addLog('Etherscan', `Fetching ABI for contract: ${address}`);
			
			// Determine the correct Etherscan API URL based on the current chain
			const chainId = currentChain.id;
			let apiUrl: string;
			
			if (chainId === 1) {
				// Ethereum Mainnet
				apiUrl = 'https://api.etherscan.io/api';
			} else if (chainId === 11155111) {
				// Sepolia
				apiUrl = 'https://api-sepolia.etherscan.io/api';
			} else if (chainId === 17000) {
				// Holesky
				apiUrl = 'https://api-holesky.etherscan.io/api';
			} else {
				throw new Error(`Unsupported chain ID: ${chainId}`);
			}
			
			// Your Etherscan API key - replace with your actual API key
			// In production, this should be stored in an environment variable
			const apiKey = import.meta.env.VITE_ETHERSCAN_API_KEY || '';
			
			// Construct the API request URL according to Etherscan documentation
			const url = `${apiUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
			
			addLog('Etherscan', `Making API request to Etherscan`);
			
			// Fetch the ABI
			const response = await fetch(url);
			
			// Check if response is OK
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			
			// Get response text first to debug
			const responseText = await response.text();
			
			// Try to parse as JSON
			let data;
			try {
				data = JSON.parse(responseText);
			} catch (parseError: unknown) {
				const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
				console.error('Failed to parse response as JSON:', responseText.substring(0, 200) + '...');
				throw new Error(`Invalid response from Etherscan API: ${errorMessage}`);
			}
			
			if (data.status === '0') {
				throw new Error(`Etherscan API error: ${data.message || 'Contract not verified'}`);
			}
			
			// Parse the ABI
			const abiString = data.result;
			
			// Validate that we have a valid ABI string
			if (!abiString || typeof abiString !== 'string') {
				throw new Error('Invalid ABI returned from Etherscan');
			}
			
			try {
				contractAbi = JSON.parse(abiString);
			} catch (abiParseError: unknown) {
				const errorMessage = abiParseError instanceof Error ? abiParseError.message : 'Unknown ABI parsing error';
				console.error('Failed to parse ABI string:', abiString.substring(0, 200) + '...');
				throw new Error(`Invalid ABI format: ${errorMessage}`);
			}
			
			// Extract functions from the ABI
			contractFunctions = contractAbi.filter(item => 
				item.type === 'function' && 
				item.stateMutability !== 'view' && 
				item.stateMutability !== 'pure'
			);
			
			if (contractFunctions.length === 0) {
				addLog('warning', 'No writable functions found in contract ABI');
			} else {
				addLog('success', `Found ${contractFunctions.length} writable functions in contract ABI`);
			}
			
		} catch (error: any) {
			console.error('Error fetching contract ABI:', error);
			abiError = error.message || 'Failed to fetch contract ABI';
			addLog('error', abiError || 'Unknown error fetching ABI');
		} finally {
			isLoadingAbi = false;
		}
	}
	
	// Watch for changes in the pasted authorization
	$: if (pastedAuthorization) {
		parseAuthorizationAndFetchAbi();
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-5xl">
	<h1 class="text-3xl font-bold mb-6">Transaction Builder</h1>
	
	<!-- Emergency Debug Display -->
	
	<!-- Warning Section - REMOVED -->
	<div class="mt-4 bg-amber-50 px-3 py-2 rounded-md inline-flex items-start w-full">
		<div class="flex-shrink-0 mt-0.5">
			<svg class="h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path fill-rule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
			</svg>
		</div>
		<div class="ml-2 flex-grow">
			<span class="text-xs text-amber-700">
				EIP-7702 requires a compatible RPC provider and wallet. This tool uses Alchemy, but your wallet might override this.
			</span>
		</div>
	</div>
	<div class="mb-8"></div>
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
					<div class="flex space-x-2">
						<button
							on:click={() => {
								navigator.clipboard.writeText(authorizationSigned);
								addLog('Authorization data copied to clipboard');
							}}
							class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
						>
							Copy Data
						</button>
						<button
							on:click={pasteAuthorizationFromAbove}
							class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
						>
							Use Below
						</button>
					</div>
				</h2>
				
				<div class="bg-gray-50 rounded-md p-4 font-mono text-sm overflow-x-auto">
					<pre>{authorizationSigned}</pre>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Custom EIP-7702 Transaction Section -->
	<div class="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
		<div class="p-6">
			<h2 class="text-xl font-semibold mb-4">Custom EIP-7702 Transaction</h2>
			<p class="text-sm text-gray-600 mb-4">
				Build and send a custom EIP-7702 transaction (type 0x4) with a signed authorization.
			</p>
			
			<form on:submit={buildTransaction} class="space-y-4">
				<!-- Pasted Authorization Input -->
				<div>
					<label for="pastedAuthorization" class="block text-sm font-medium text-gray-700 mb-1">
						Signed Authorization
					</label>
					<textarea
						id="pastedAuthorization"
						bind:value={pastedAuthorization}
						placeholder="Paste signed authorization JSON here..."
						class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm h-32"
					></textarea>
					<p class="mt-1 text-sm text-gray-500">Paste a signed authorization or use the "Use Below" button from above</p>
				</div>
				
				<!-- Contract ABI Status -->
				{#if isLoadingAbi}
					<div class="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm">
						<div class="flex items-center">
							<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span>Fetching contract ABI from Etherscan...</span>
						</div>
					</div>
				{:else if abiError}
					<div class="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
						<p class="font-medium">Contract ABI Error:</p>
						<p>{abiError}</p>
						<p class="mt-2">The contract may not be verified on Etherscan. You cannot proceed without a verified contract.</p>
					</div>
				{:else if contractFunctions.length > 0}
					<div class="p-4 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm">
						<p class="font-medium">✅ Contract ABI loaded successfully</p>
						<p>Found {contractFunctions.length} writable functions in the contract.</p>
					</div>
					
					<!-- Function Selector Dropdown -->
					<div>
						<label for="functionSelector" class="block text-sm font-medium text-gray-700 mb-1">
							Select Contract Function
						</label>
						<select
							id="functionSelector"
							bind:value={selectedFunction}
							class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
						>
							<option value="">-- Select a function --</option>
							{#each contractFunctions as func}
								<option value={func.name}>
									{func.name}({func.inputs.map((input: any) => `${input.type} ${input.name}`).join(', ')})
								</option>
							{/each}
						</select>
						<p class="mt-1 text-sm text-gray-500">Choose a function to call on the contract</p>
					</div>
					
					<!-- Function Details (if a function is selected) -->
					{#if selectedFunction}
						<div class="p-4 bg-gray-50 border border-gray-200 rounded-md">
							<h3 class="text-md font-medium text-gray-700 mb-2">Function Details</h3>
							{#if contractFunctions.find(f => f.name === selectedFunction)}
								{@const selectedFunctionDetails = contractFunctions.find(f => f.name === selectedFunction)}
								<div class="space-y-2">
									<p class="text-sm"><span class="font-medium">Name:</span> {selectedFunctionDetails.name}</p>
									<p class="text-sm"><span class="font-medium">Type:</span> {selectedFunctionDetails.stateMutability}</p>
									
									{#if selectedFunctionDetails.inputs.length > 0}
										<div>
											<p class="text-sm font-medium">Inputs:</p>
											<ul class="list-disc list-inside text-sm pl-2">
												{#each selectedFunctionDetails.inputs as input}
													<li>{input.type} {input.name}</li>
												{/each}
											</ul>
										</div>
									{:else}
										<p class="text-sm">No inputs required</p>
									{/if}
								</div>
							{/if}
						</div>
						
						<!-- Transaction Value Input for Payable Functions -->
						{#if contractFunctions.find(f => f.name === selectedFunction && isPayableFunction(f))}
							<div class="mt-4 p-4 border border-gray-200 rounded-md bg-blue-50">
								<h3 class="text-md font-medium text-gray-700 mb-3">Transaction Value</h3>
								<div class="flex items-center">
									<input
										type="number"
										id="transaction-value"
										placeholder="0.0"
										class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
										bind:value={transactionValue}
										step="0.000000000000000001"
										min="0"
									/>
									<span class="ml-2 text-gray-600 font-medium">ETH</span>
								</div>
								<p class="mt-1 text-xs text-gray-500">
									This function is payable. Enter the amount of ETH to send with the transaction.
								</p>
							</div>
						{/if}
						
						<!-- Function Arguments Input Fields -->
						{#if contractFunctions.find(f => f.name === selectedFunction)}
							{@const selectedFunctionDetails = contractFunctions.find(f => f.name === selectedFunction)}
							{#if selectedFunctionDetails.inputs.length > 0}
								<div class="mt-4 p-4 border border-gray-200 rounded-md">
									<h3 class="text-md font-medium text-gray-700 mb-3">Function Arguments</h3>
									
									<div class="space-y-3">
										{#each selectedFunctionDetails.inputs as input, index}
											<div>
												<label for={`input-${index}`} class="block text-sm font-medium text-gray-700 mb-1">
													{input.name} <span class="text-xs text-gray-500">({input.type})</span>
												</label>
												
												{#if input.type.includes('tuple[]')}
													<!-- Array of tuples/structs -->
													<div class="border border-gray-200 rounded-md p-3 mb-2">
														<p class="text-sm font-medium mb-2">Array of objects - add items:</p>
														
														<div id="tupleArrayContainer-{index}" class="space-y-3">
															<!-- Dynamic tuple items will be added here -->
															{#each functionInputValues[index.toString()] ? JSON.parse(functionInputValues[index.toString()] || '[]') : [] as tupleItem, tupleIndex}
																<div class="border border-gray-200 rounded-md p-2 bg-gray-50">
																	<div class="flex justify-between items-center mb-2">
																		<span class="text-xs font-medium">Item #{tupleIndex + 1}</span>
																		<button 
																			type="button" 
																			class="text-red-500 text-xs"
																			on:click={() => {
																				const currentArray = JSON.parse(functionInputValues[index.toString()] || '[]');
																				currentArray.splice(tupleIndex, 1);
																				functionInputValues[index.toString()] = JSON.stringify(currentArray);
																			}}
																		>
																			Remove
																		</button>
																	</div>
																	
																	{#if input.components}
																		{#each input.components as component, componentIndex}
																			<div class="mb-2">
																				<label class="block text-xs font-medium text-gray-600 mb-1">
																					{component.name} <span class="text-xs text-gray-500">({component.type})</span>
																				</label>
																				<input
																					type="text"
																					class="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
																					value={tupleItem[component.name] || ''}
																					on:input={(e) => {
																						const currentArray = JSON.parse(functionInputValues[index.toString()] || '[]');
																						if (!currentArray[tupleIndex]) {
																							currentArray[tupleIndex] = {};
																						}
																						currentArray[tupleIndex][component.name] = e.currentTarget.value;
																						functionInputValues[index.toString()] = JSON.stringify(currentArray);
																					}}
																				/>
																			</div>
																		{/each}
																	{/if}
																</div>
															{/each}
														</div>
														
														<button 
															type="button"
															class="mt-2 px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-md hover:bg-blue-100"
															on:click={() => {
																const currentArray = JSON.parse(functionInputValues[index.toString()] || '[]');
																currentArray.push({});
																functionInputValues[index.toString()] = JSON.stringify(currentArray);
															}}
														>
															+ Add Item
														</button>
														
														<p class="mt-1 text-xs text-gray-500">
															Click "Add Item" to add entries to the array.
														</p>
													</div>
												{:else if input.type.includes('tuple')}
													<!-- Single tuple/struct -->
													<div class="border border-gray-200 rounded-md p-3">
														{#if input.components}
															{#each input.components as component, componentIndex}
																<div class="mb-2">
																	<label class="block text-xs font-medium text-gray-600 mb-1">
																		{component.name} <span class="text-xs text-gray-500">({component.type})</span>
																	</label>
																	
																	{#if component.type.includes('uint') || component.type.includes('int')}
																		<input
																			type="text"
																			placeholder={`Enter ${component.name} (${component.type})`}
																			class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
																			on:input={(e) => {
																				let currentObj = {};
																				try {
																					currentObj = JSON.parse(functionInputValues[index.toString()] || '{}');
																				} catch (e) {
																					currentObj = {};
																				}
																				currentObj[component.name] = e.currentTarget.value;
																				functionInputValues[index.toString()] = JSON.stringify(currentObj);
																			}}
																		/>
																	{:else if component.type === 'address'}
																		<input
																			type="text"
																			placeholder="0x..."
																			class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
																			on:input={(e) => {
																				let currentObj = {};
																				try {
																					currentObj = JSON.parse(functionInputValues[index.toString()] || '{}');
																				} catch (e) {
																					currentObj = {};
																				}
																				currentObj[component.name] = e.currentTarget.value;
																				functionInputValues[index.toString()] = JSON.stringify(currentObj);
																			}}
																		/>
																	{:else if component.type === 'bool'}
																		<select
																			class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
																			on:change={(e) => {
																				let currentObj = {};
																				try {
																					currentObj = JSON.parse(functionInputValues[index.toString()] || '{}');
																				} catch (e) {
																					currentObj = {};
																				}
																				currentObj[component.name] = e.currentTarget.value === 'true';
																				functionInputValues[index.toString()] = JSON.stringify(currentObj);
																			}}
																		>
																			<option value="true">true</option>
																			<option value="false">false</option>
																		</select>
																	{:else if component.type.includes('bytes')}
																		<input
																			type="text"
																			placeholder="0x..."
																			class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
																			on:input={(e) => {
																				let currentObj = {};
																				try {
																					currentObj = JSON.parse(functionInputValues[index.toString()] || '{}');
																				} catch (e) {
																					currentObj = {};
																				}
																				currentObj[component.name] = e.currentTarget.value;
																				functionInputValues[index.toString()] = JSON.stringify(currentObj);
																			}}
																		/>
																	{:else}
																		<input
																			type="text"
																			placeholder={`Enter ${component.name}`}
																			class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
																			on:input={(e) => {
																				let currentObj = {};
																				try {
																					currentObj = JSON.parse(functionInputValues[index.toString()] || '{}');
																				} catch (e) {
																					currentObj = {};
																				}
																				currentObj[component.name] = e.currentTarget.value;
																				functionInputValues[index.toString()] = JSON.stringify(currentObj);
																			}}
																		/>
																	{/if}
																</div>
															{/each}
														{/if}
														<p class="mt-1 text-xs text-gray-500">
															Fill in all fields for this object.
														</p>
													</div>
												{:else if input.type.includes('uint')}
													<!-- Number input for uint types -->
													<input
														type="text"
														id={`input-${index}`}
														placeholder={`Enter ${input.name} (${input.type})`}
														class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
														pattern="[0-9]*"
														bind:value={functionInputValues[index.toString()]}
														on:input={(e) => handleInputChange(index, e.currentTarget.value)}
													/>
													<p class="mt-1 text-xs text-gray-500">
														{#if input.type.includes('uint256')}
															Enter a number (can be large). For very large numbers, you can use scientific notation (e.g., 1e18).
														{:else}
															Enter a number appropriate for {input.type}.
														{/if}
													</p>
												{:else if input.type.includes('int')}
													<!-- Number input for int types -->
													<input
														type="text"
														id={`input-${index}`}
														placeholder={`Enter ${input.name} (${input.type})`}
														class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
														bind:value={functionInputValues[index.toString()]}
														on:input={(e) => handleInputChange(index, e.currentTarget.value)}
													/>
													<p class="mt-1 text-xs text-gray-500">
														Enter a number appropriate for {input.type}.
													</p>
												{:else if input.type === 'bool'}
													<!-- Boolean input -->
													<select
														id={`input-${index}`}
														class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
														bind:value={functionInputValues[index.toString()]}
														on:change={(e) => handleInputChange(index, e.currentTarget.value)}
													>
														<option value="true">true</option>
														<option value="false">false</option>
													</select>
												{:else if input.type === 'address'}
													<!-- Address input -->
													<input
														type="text"
														id={`input-${index}`}
														placeholder="0x..."
														class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
														bind:value={functionInputValues[index.toString()]}
														on:input={(e) => handleInputChange(index, e.currentTarget.value)}
													/>
													<p class="mt-1 text-xs text-gray-500">
														Enter a valid Ethereum address (0x...).
													</p>
												{:else if input.type === 'string'}
													<!-- String input -->
													<input
														type="text"
														id={`input-${index}`}
														placeholder={`Enter ${input.name}`}
														class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
														bind:value={functionInputValues[index.toString()]}
														on:input={(e) => handleInputChange(index, e.currentTarget.value)}
													/>
												{:else if input.type.includes('bytes')}
													<!-- Bytes input -->
													<input
														type="text"
														id={`input-${index}`}
														placeholder="0x..."
														class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
														bind:value={functionInputValues[index.toString()]}
														on:input={(e) => handleInputChange(index, e.currentTarget.value)}
													/>
													<p class="mt-1 text-xs text-gray-500">
														Enter bytes in hex format (0x...).
													</p>
												{:else if input.type.includes('[]')}
													<!-- Array input -->
													<textarea
														id={`input-${index}`}
														placeholder={`Enter comma-separated values for ${input.name}`}
														class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm h-20"
														bind:value={functionInputValues[index.toString()]}
														on:input={(e) => handleInputChange(index, e.currentTarget.value)}
													></textarea>
													<p class="mt-1 text-xs text-gray-500">
														Enter comma-separated values for array.
													</p>
												{:else}
													<!-- Default fallback for other types -->
													<input
														type="text"
														id={`input-${index}`}
														placeholder={`Enter ${input.name} (${input.type})`}
														class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
														bind:value={functionInputValues[index.toString()]}
														on:input={(e) => handleInputChange(index, e.currentTarget.value)}
													/>
													<p class="mt-1 text-xs text-gray-500">
														Enter a value appropriate for {input.type}.
													</p>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					{/if}
				{/if}
				
				<!-- Submit Button -->
				<div class="flex justify-end mt-4">
					<button
						type="submit"
						disabled={isProcessingTransaction || !pastedAuthorization || !selectedFunction || abiError !== null}
						class="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						{isProcessingTransaction ? 'Building...' : 'Create Transaction'}
					</button>
				</div>
				
				<!-- Error Message -->
				{#if transactionError}
					<div class="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm mt-4">
						{transactionError}
					</div>
				{/if}
			</form>
		</div>
	</div>
	
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

<!-- Transaction Modal -->
{#if showTransactionModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
			<div class="p-6">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-xl font-semibold">Built EIP-7702 Transaction</h2>
					<button 
						on:click={closeTransactionModal}
						class="text-gray-500 hover:text-gray-700"
						aria-label="Close modal"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				
				<div class="mb-4">
					<p class="text-sm text-gray-600 mb-2">
						This is the built EIP-7702 transaction (type 0x4) with your signed authorization.
					</p>
					<p class="text-sm text-gray-600 mb-4">
						You can copy this transaction data or sign and send it directly.
					</p>
					
					<!-- Transaction Status Section -->
					{#if transactionHash}
						<div class="mb-4 p-4 rounded-md {transactionStatus === 'confirmed' ? 'bg-green-50 border border-green-200' : transactionStatus === 'failed' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}">
							<p class="font-medium mb-1 {transactionStatus === 'confirmed' ? 'text-green-700' : transactionStatus === 'failed' ? 'text-red-700' : 'text-blue-700'}">
								{#if transactionStatus === 'confirmed'}
									✅ Transaction Confirmed
								{:else if transactionStatus === 'failed'}
									❌ Transaction Failed
								{:else}
									⏳ Transaction Pending
								{/if}
							</p>
							<p class="text-sm break-all">
								Transaction Hash: <a href="{currentChain.blockExplorers?.default.url}/tx/{transactionHash}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">{transactionHash}</a>
							</p>
						</div>
					{/if}
					
					<div class="flex justify-end mb-2 space-x-2">
						<button
							on:click={copyTransactionToClipboard}
							class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
							</svg>
							Copy Transaction
						</button>
					</div>
					
					<div class="bg-gray-50 rounded-md p-4 font-mono text-xs overflow-x-auto max-h-[50vh] overflow-y-auto">
						<pre>{JSON.stringify(builtTransaction, null, 2)}</pre>
					</div>
				</div>
				
				<div class="flex justify-between">
					<button
						on:click={closeTransactionModal}
						class="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
					>
						Close
					</button>
					
					<button
						on:click={sendTransaction}
						disabled={isSendingTransaction || transactionStatus === 'confirmed'}
						class="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
					>
						{#if isSendingTransaction}
							<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Sending...
						{:else if transactionStatus === 'confirmed'}
							Transaction Sent
						{:else if transactionStatus === 'failed'}
							Retry Send
						{:else}
							Sign & Send Transaction
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if} 