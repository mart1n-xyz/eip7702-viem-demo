<!-- SigningModal.svelte -->
<script lang="ts">
  export let show = false;
  export let title: string;
  export let message: string;
  export let data: string;
  export let onConfirm: () => void;
  export let onCancel: () => void;
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
      <div class="p-6 flex-shrink-0">
        <h2 class="text-xl font-medium text-gray-800 mb-4">{title}</h2>
        
        <p class="text-gray-600 mb-4 whitespace-pre-line">{message}</p>
      </div>
      
      <div class="px-6 overflow-y-auto flex-grow" style="max-height: calc(90vh - 200px);">
        <div class="bg-gray-50 rounded-lg p-4 font-mono text-sm mb-6 overflow-x-auto">
          <pre class="whitespace-pre-wrap break-all">{data}</pre>
        </div>
      </div>
      
      <div class="p-6 border-t border-gray-200 flex-shrink-0">
        <div class="flex justify-end space-x-4">
          <button
            class="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium rounded-lg"
            on:click={onCancel}
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            on:click={onConfirm}
          >
            Sign
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 