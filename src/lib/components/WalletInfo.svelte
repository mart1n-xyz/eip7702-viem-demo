<script lang="ts">
  import { walletStore, formatAddress, formatEthBalance } from '$lib/wallet';
  
  let copySuccess = false;
  
  function copyToClipboard(text: string) {
    if (!text) return;
    
    navigator.clipboard.writeText(text)
      .then(() => {
        copySuccess = true;
        setTimeout(() => {
          copySuccess = false;
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  }
</script>

<div class="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-100">
  <div class="border-b border-gray-100 px-6 py-4">
    <h2 class="text-xl font-medium text-gray-800 flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      Wallet Information
    </h2>
  </div>
  
  {#if $walletStore.error}
    <div class="bg-red-50 border-l-2 border-red-400 p-4 m-4 rounded">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-red-600">{$walletStore.error}</p>
        </div>
      </div>
    </div>
  {/if}
  
  <div class="p-6">
    {#if !$walletStore.isConnected}
      <div class="bg-gray-50 p-6 rounded text-center">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <p class="text-gray-600 mb-2">Connect your wallet to see your Sepolia ETH balance</p>
        <p class="text-sm text-gray-500">Use the Connect Wallet button in the navigation bar</p>
      </div>
    {:else}
      <div class="space-y-5">
        <div class="flex justify-between items-center">
          <span class="text-gray-500">Status</span>
          <span class="text-green-600 flex items-center text-sm">
            <span class="h-2 w-2 bg-green-400 rounded-full mr-2"></span>
            Connected
          </span>
        </div>
        
        <div class="border-t border-gray-100 pt-4">
          <div class="flex justify-between items-center">
            <span class="text-gray-500">Network</span>
            <span class="text-gray-800 text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Sepolia Testnet
            </span>
          </div>
        </div>
        
        <div class="border-t border-gray-100 pt-4">
          <div class="mb-1 flex justify-between">
            <span class="text-gray-500">Address</span>
            <div class="relative">
              <button 
                class="text-blue-400 hover:text-blue-500 text-sm flex items-center"
                on:click={() => {
                  if ($walletStore.address) {
                    copyToClipboard($walletStore.address);
                  }
                }}
              >
                {#if copySuccess}
                  <span class="text-green-500 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    Copied
                  </span>
                {:else}
                  <span>Copy</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>
          <div class="bg-gray-50 p-3 rounded break-all font-mono text-sm text-gray-600">
            {$walletStore.address}
          </div>
        </div>
        
        <div class="border-t border-gray-100 pt-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-500">Balance</span>
            <span class="text-xl font-medium text-gray-800">{formatEthBalance($walletStore.balance)} ETH</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-1.5">
            <div class="bg-blue-300 h-1.5 rounded-full" style="width: {Math.min(Number(formatEthBalance($walletStore.balance)) * 10, 100)}%"></div>
          </div>
          <p class="text-xs text-gray-400 mt-1">Sepolia testnet ETH has no real value</p>
        </div>
        
        <div class="border-t border-gray-100 pt-4 flex justify-between">
          <a 
            href={`https://sepolia.etherscan.io/address/${$walletStore.address}`} 
            target="_blank" 
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-500 text-sm flex items-center"
          >
            View on Etherscan
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          
          <a 
            href="https://faucet.sepolia.dev/" 
            target="_blank" 
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-500 text-sm flex items-center"
          >
            Get test ETH
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </a>
        </div>
      </div>
    {/if}
  </div>
</div> 