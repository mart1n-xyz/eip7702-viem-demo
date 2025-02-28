<script lang="ts">
  import { walletStore } from '$lib/wallet';
  import { sepolia } from 'viem/chains';
  
  // Check if connected to the correct chain (Sepolia)
  $: isCorrectChain = $walletStore.isConnected && window?.ethereum?.chainId === `0x${sepolia.id.toString(16)}`;
  
  // Function to switch network and reload page
  function switchToSepolia() {
    if (window.ethereum) {
      window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${sepolia.id.toString(16)}` }]
      })
      .then(() => {
        // Reload page after 1 second
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      })
      .catch(console.error);
    }
  }
</script>

<div class="flex flex-col items-center justify-center px-4 sm:px-6">
  <div class="bg-white shadow-sm rounded-lg border border-gray-100 w-full max-w-2xl p-6 sm:p-8">
    <h1 class="text-2xl font-medium text-gray-800 mb-4">Batch Transfer</h1>
    
    <div class="prose prose-sm max-w-none text-gray-600">
      {#if !$walletStore.isConnected}
        <!-- Not connected state -->
        <div class="p-6 bg-gray-50 rounded-lg text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-700 mb-2">Connect Wallet to Explore</h3>
        </div>
      {:else if !isCorrectChain}
        <!-- Wrong network state -->
        <div class="p-6 bg-yellow-50 border border-yellow-100 rounded-lg text-center">
          <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-700 mb-2">Wrong Network</h3>
          <p class="text-gray-600 mb-4">Please switch to the Sepolia testnet to use this example</p>
          <button 
            class="bg-blue-400 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            on:click={switchToSepolia}
          >
            Switch to Sepolia
          </button>
        </div>
      {:else}
        <!-- Connected and correct network state -->
        <div class="p-4 bg-blue-50 border border-blue-100 rounded-md mb-6">
          <p class="mb-2">
            This page will demonstrate batch transfer functionality using EIP-7702.
          </p>
          <p>
            <span class="text-blue-400">Coming soon...</span>
          </p>
        </div>
        
        <p class="mb-4">
          Batch transfers allow you to send multiple transactions in a single operation, saving gas and simplifying complex operations.
        </p>
        
        <p class="mb-4">
          With EIP-7702, your EOA can temporarily adopt smart contract functionality to execute multiple transfers atomically.
        </p>
        
        <div class="mt-6 pt-4 border-t border-gray-100 text-center">
          <p class="text-sm text-gray-500">
            Your wallet is connected and ready to use this feature once it's available.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div> 