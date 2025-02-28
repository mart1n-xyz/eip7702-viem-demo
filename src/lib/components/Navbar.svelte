<script lang="ts">
  import { walletStore, connectWallet, disconnectWallet, formatAddress, formatEthBalance } from '$lib/wallet';
  
  let connecting = false;
  
  async function handleConnect() {
    if ($walletStore.isConnected) {
      disconnectWallet();
      return;
    }
    
    connecting = true;
    try {
      await connectWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      connecting = false;
    }
  }
</script>

<nav class="bg-white border-b border-gray-100 shadow-sm">
  <div class="container mx-auto px-4 py-3">
    <div class="flex justify-between items-center">
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <span class="text-gray-800 font-medium text-lg">EIP-7702 Demo</span>
      </div>
      
      <div class="flex items-center gap-4">
        {#if $walletStore.isConnected && $walletStore.address}
          <div class="hidden md:flex items-center space-x-3">
            <div class="border border-gray-200 rounded-full px-3 py-1 text-gray-600 flex items-center">
              <div class="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
              <span class="font-mono text-sm">{formatAddress($walletStore.address)}</span>
            </div>
            <div class="border border-gray-200 rounded-full px-3 py-1 text-gray-600">
              <span class="font-medium">{formatEthBalance($walletStore.balance)} ETH</span>
            </div>
          </div>
        {/if}
        
        <button 
          on:click={handleConnect}
          disabled={connecting || $walletStore.isConnecting}
          class="bg-white border border-blue-500 text-blue-500 hover:bg-blue-50 font-medium py-1.5 px-4 rounded-full transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <span class="flex items-center">
            {#if connecting || $walletStore.isConnecting}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            {:else if $walletStore.isConnected}
              <svg class="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect
            {:else}
              <svg class="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Connect Wallet
            {/if}
          </span>
        </button>
      </div>
    </div>
  </div>
</nav> 