<script lang="ts">
  import { walletStore } from '$lib/wallet';
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh]">
  <div class="text-center p-8 bg-white shadow-sm rounded-lg border border-gray-100 max-w-md w-full">
    {#if !$walletStore.isConnected}
      <p class="text-xl text-gray-700">Connect wallet</p>
      <p class="text-sm text-gray-500 mt-2">This is a placeholder</p>
    {:else}
      <p class="text-xl text-gray-700">Wallet connected</p>
      <p class="text-sm text-gray-500 mt-2">This is a placeholder</p>
    {/if}
  </div>
</div>
