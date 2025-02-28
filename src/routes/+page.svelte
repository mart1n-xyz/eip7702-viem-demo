<script lang="ts">
  import { walletStore } from '$lib/wallet';
</script>

<div class="flex flex-col items-center justify-center px-4 sm:px-6">
  <div class="bg-white shadow-sm rounded-lg border border-gray-100 w-full max-w-2xl p-6 sm:p-8">
    <h1 class="text-2xl font-medium text-gray-800 mb-4">EIP-7702 Demo</h1>
    
    <div class="prose prose-sm max-w-none text-gray-600">
      <div class="p-4 bg-blue-50 border border-blue-100 rounded-md mb-6">
        <p class="mb-2">
          This demo showcases example implementations of EIP-7702 from <a href="https://viem.sh/experimental/eip7702" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-500">viem docs</a>. These are deployed on Sepolia testnet.
        </p>
        <p>
          Connect your wallet and play with the examples.
        </p>
      </div>
      
      <h2 class="text-xl font-medium text-gray-800 mb-3">What is EIP-7702?</h2>
      
      <p class="mb-4">
        EIP-7702 introduces a new transaction type (0x04) that enables Externally Owned Accounts (EOAs) to temporarily adopt smart contract functionality without permanently converting to a contract account.
      </p>
      
      <p class="mb-4">
        At its core, this proposal creates a mechanism for "delegation designation" where an EOA can point to a contract implementation. When the EOA is called, the EVM executes the code from the designated contract while maintaining the EOA's context, storage, and balance.
      </p>
      
      <p class="mb-4">
        The delegation is established through an <strong>authorization list</strong> containing cryptographically signed tuples. Each tuple includes <code>chain_id</code>, <code>address</code> (of the implementation contract), <code>nonce</code>, and signature components. When processed, this creates a special code pattern (<code>0xef0100 || address</code>) in the EOA that redirects code execution.
      </p>
      
      <h2 class="text-xl font-medium text-gray-800 mt-6 mb-3">Key Applications</h2>
      
      <ul class="space-y-2 mb-4">
        <li>
          <strong>Transaction Batching:</strong> Combine multiple operations into a single atomic transaction, such as approving and then spending tokens in one step
        </li>
        <li>
          <strong>Transaction Sponsorship:</strong> Allow one account to pay gas fees for another account's transaction, enabling gasless transactions for users
        </li>
        <li>
          <strong>Granular Permissions:</strong> Create limited-capability sub-keys with specific permissions (e.g., only interact with certain contracts or limit spending amounts)
        </li>
      </ul>
      
      <div class="mt-6 pt-4 border-t border-gray-100">
        <p>
          For the complete technical specification, refer to <a href="https://eips.ethereum.org/EIPS/eip-7702" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-500">EIP-7702</a>.
        </p>
      </div>
    </div>
  </div>
</div>
