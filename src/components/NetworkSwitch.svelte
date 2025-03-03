<!-- Network switch button with indicator -->
<script lang="ts">
  import { currentChainConfig, type ChainConfig, chainConfigs, switchNetwork } from '$lib/chainConfig';
  
  // Get the current network name based on the chain config
  $: networkName = Object.entries(chainConfigs).find(
    ([_, config]) => config.chain.id === $currentChainConfig.chain.id
  )?.[0] ?? 'unknown';
  
  // Get capitalized network names
  const networkNames = {
    sepolia: 'Sepolia',
    holesky: 'Holesky'
  } as const;
  
  // Toggle between networks
  function toggleNetwork() {
    if (networkName === 'sepolia') {
      switchNetwork('holesky');
    } else {
      switchNetwork('sepolia');
    }
  }

  let isHovered = false;
</script>

<button
  class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border relative group"
  class:bg-purple-100={networkName === 'sepolia'}
  class:border-purple-200={networkName === 'sepolia'}
  class:bg-blue-100={networkName === 'holesky'}
  class:border-blue-200={networkName === 'holesky'}
  on:click={toggleNetwork}
>
  <!-- Network indicator dot -->
  <span
    class="w-2 h-2 rounded-full"
    class:bg-purple-500={networkName === 'sepolia'}
    class:bg-blue-500={networkName === 'holesky'}
  />
  
  <!-- Network name -->
  <span class="capitalize">
    {networkName}
  </span>

  <!-- Tooltip -->
  <div class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(100%+8px)] px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
    Switch to {networkNames[networkName === 'sepolia' ? 'holesky' : 'sepolia']}
    <!-- Tooltip arrow -->
    <div class="absolute top-1/2 -translate-y-1/2 right-[-8px] border-4 border-transparent border-l-gray-900"></div>
  </div>
</button>

<style>
  /* Add any additional styles here if needed */
</style> 