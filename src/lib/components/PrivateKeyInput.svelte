<!-- PrivateKeyInput.svelte -->
<script lang="ts">
  import { walletStore, connectWithPrivateKey } from '$lib/wallet';
  import { onMount } from 'svelte';
  
  let privateKey = '';
  let isSubmitting = false;
  let showPrivateKey = false;
  let error: string | null = null;
  
  async function handleSubmit() {
    if (!privateKey) {
      error = 'Please enter a private key';
      return;
    }
    
    try {
      isSubmitting = true;
      error = null;
      await connectWithPrivateKey(privateKey);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="rounded-lg bg-gray-50 p-6">
  <div class="mb-4">
    <h3 class="text-lg font-medium text-gray-800 mb-2">Connect with Private Key</h3>
    <p class="text-sm text-gray-600">
      Use this option to connect with a private key. The key will only be used for signing and won't be stored.
    </p>
  </div>
  
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <div>
      <label for="privateKey" class="block text-sm font-medium text-gray-700 mb-1">
        Private Key
      </label>
      <div class="relative">
        <input
          id="privateKey"
          type={showPrivateKey ? 'text' : 'password'}
          bind:value={privateKey}
          placeholder="Enter your private key (with or without 0x prefix)"
          class="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
          disabled={isSubmitting}
        />
        <button
          type="button"
          class="absolute inset-y-0 right-0 px-3 flex items-center"
          on:click={() => showPrivateKey = !showPrivateKey}
        >
          {#if showPrivateKey}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
            </svg>
          {/if}
        </button>
      </div>
      
      
      <!-- Warning about using private keys with real funds -->
      <div class="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700 flex items-start">
        <svg class="h-4 w-4 text-red-500 mr-1 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
        </svg>
        <span>
          Never use a private key of an address with real funds on mainnet.
        </span>
      </div>
    </div>
    
    {#if error}
      <div class="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    {/if}
    
    <button
      type="submit"
      class="w-full flex justify-center items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isSubmitting}
    >
      {#if isSubmitting}
        <svg
          class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
        Connecting...
      {:else}
        Connect with Private Key
      {/if}
    </button>
  </form>
</div> 