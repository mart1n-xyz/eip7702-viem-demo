<script lang="ts">
  import { walletStore, connectWallet, disconnectWallet, formatAddress, formatEthBalance } from '$lib/wallet';
  import { page } from '$app/stores';
  import NetworkSwitch from '../../components/NetworkSwitch.svelte';
  
  let connecting = false;
  let mobileMenuOpen = false;
  
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
  
  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }
  
  // Check if a path is active
  function isActive(path: string): boolean {
    return $page.url.pathname === path;
  }
</script>

<nav class="bg-white border-b border-gray-100 shadow-sm">
  <div class="container mx-auto px-4 py-3">
    <div class="flex justify-between items-center">
      <div class="flex items-center">
        <h1 class="text-2xl text-gray-800 tracking-tight mr-32">
          <span class="font-bold text-blue-400">EIP-7702</span> <span class="font-light">Demo</span>
        </h1>
        
        <div class="hidden md:flex space-x-6">
          <a 
            href="/" 
            class="transition-colors duration-200 {isActive('/') ? 'text-blue-400 font-medium' : 'text-gray-600 hover:text-blue-400 font-medium'}"
          >
            Home
          </a>
          <a 
            href="/batch-transfer" 
            class="transition-colors duration-200 {isActive('/batch-transfer') ? 'text-blue-400 font-medium' : 'text-gray-600 hover:text-blue-400 font-medium'}"
          >
            Batch Transfer Example
          </a>
          <a 
            href="/custom-contract" 
            class="transition-colors duration-200 {isActive('/custom-contract') ? 'text-blue-400 font-medium' : 'text-gray-600 hover:text-blue-400 font-medium'}"
          >
            Transaction Builder
          </a>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <!-- Mobile menu button -->
        <button 
          class="md:hidden text-gray-500 hover:text-gray-700 focus:outline-none"
          on:click={toggleMobileMenu}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
        
        {#if $walletStore.isConnected && $walletStore.address}
          <div class="hidden md:flex items-center space-x-3">
            <NetworkSwitch />
            <div class="border border-gray-200 rounded-full px-3 py-1 text-gray-600 flex items-center">
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
          class="bg-white border border-blue-400 text-blue-400 hover:bg-blue-50 font-medium py-1.5 px-4 rounded-full transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <span class="flex items-center">
            {#if connecting || $walletStore.isConnecting}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
    
    <!-- Mobile menu -->
    {#if mobileMenuOpen}
      <div class="md:hidden mt-3 pt-3 border-t border-gray-100">
        <div class="flex flex-col items-center space-y-3 pb-3">
          <NetworkSwitch />
          <a 
            href="/" 
            class="py-1 {isActive('/') ? 'text-blue-400 font-medium' : 'text-gray-600 hover:text-blue-400 font-medium'}"
          >
            Home
          </a>
          <a 
            href="/batch-transfer" 
            class="py-1 {isActive('/batch-transfer') ? 'text-blue-400 font-medium' : 'text-gray-600 hover:text-blue-400 font-medium'}"
          >
            Batch Transfer Example
          </a>
          <a 
            href="/custom-contract" 
            class="py-1 {isActive('/custom-contract') ? 'text-blue-400 font-medium' : 'text-gray-600 hover:text-blue-400 font-medium'}"
          >
            Transaction Builder
          </a>
        </div>
        
        {#if $walletStore.isConnected && $walletStore.address}
          <div class="pt-3 border-t border-gray-100 flex flex-col space-y-2">
            <div class="text-sm text-gray-500">Connected as:</div>
            <div class="border border-gray-200 rounded-full px-3 py-1 text-gray-600 flex items-center self-start">
              <span class="font-mono text-sm">{formatAddress($walletStore.address)}</span>
            </div>
            <div class="border border-gray-200 rounded-full px-3 py-1 text-gray-600 self-start">
              <span class="font-medium">{formatEthBalance($walletStore.balance)} ETH</span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</nav> 