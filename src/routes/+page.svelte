<script lang="ts">
  import { walletStore } from '$lib/wallet';
</script>

<div class="flex flex-col items-center justify-center px-4 sm:px-6">
  <div class="bg-white shadow-sm rounded-lg border border-gray-100 w-full max-w-2xl p-6 sm:p-8">
    <h1 class="text-2xl font-medium text-gray-800 mb-3">EIP-7702 Demo</h1>
    
    <div class="prose prose-sm max-w-none text-gray-600">
      <p class="mb-2">
        Hey there! Welcome to this interactive EIP-7702 playground. This cool new Ethereum feature lets regular wallets use smart contract functionality without actually deploying contracts.
      </p>
      <p class="mb-4">
        Connect your wallet and explore what EIP-7702 can do for you. We've set up the UI for Holesky and Sepolia testnets, so you can experiment freely!
      </p>
      <div class="mt-4 bg-amber-50 px-3 py-2 rounded-md inline-flex items-start w-full">
        <div class="flex-shrink-0 mt-0.5">
          <svg class="h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-2 flex-grow">
          <span class="text-xs text-amber-700">
            At the time of writing, this app does not work on Sepolia (Pectra hardfork bugs) and there is no support by any browser wallet yet. EIP-7702 also requires compatible RPC providers; this app uses Alchemy. Therefore, use this with a private key on Holesky for now.
          </span>
        </div>
      </div>
      <div class="mt-4 space-y-4 mb-6">
        <div class=" border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <h3 class="text-lg font-medium text-gray-800 mb-2">👉 Try This Example: Batch Transfer</h3>
          <p class="text-gray-600 mb-2">
            See EIP-7702 in action with the example from viem's docs! Send ETH to multiple recipients in a single transaction - something normally impossible with a regular wallet.
          </p>
          <a href="/batch-transfer" class="inline-flex items-center text-blue-500 hover:text-blue-600">
            Try the example 
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </a>
        </div>
        
        <div class=" border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <h3 class="text-lg font-medium text-gray-800 mb-2">🛠️ Build Your Own: Transaction Builder</h3>
          <p class="text-gray-600 mb-2">
            The real power tool! Test EIP-7702 with <em>any</em> contract of your choice. Just paste a contract address, select a function, and our tool will handle the EIP-7702 transaction setup for you.
          </p>
          <a href="/custom-contract" class="inline-flex items-center text-blue-500 hover:text-blue-600">
            Open the builder 
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </a>
        </div>
      </div>
      
      <div class="bg-blue-50 border-blue-100 rounded-md mb-4">
        <h2 class="text-xl font-medium text-gray-800 px-4 pt-3 pb-1">What's EIP-7702?</h2>
        
        <div class="px-4 pb-4">
          <p class="mb-3">
            EIP-7702 is one of the most exciting Ethereum improvements in a while. It lets your regular wallet (EOA) temporarily gain smart contract superpowers!
          </p>
          
          <p class="mb-3">
            Imagine your wallet could:
          </p>
          
          <ul class="space-y-2 mb-3 pl-5 list-disc">
            <li>
              <strong>Do multiple things in one go</strong> - Like sending tokens to 10 people at once, saving you gas and time
            </li>
            <li>
              <strong>Let someone else pay gas fees for you</strong> - Perfect for onboarding new users who don't have ETH yet
            </li>
          </ul>
          
          <p class="mb-3">
            Without EIP-7702, you'd need to deploy an actual smart contract wallet to do any of this. Now your regular wallet can have these powers temporarily, exactly when needed!
          </p>
          
          <p class="italic text-sm text-gray-500 mt-4">
            Technically speaking: EIP-7702 introduces a new transaction type (0x04) with a delegation mechanism that injects contract code into your EOA's execution context.
          </p>
        </div>
      </div>
      
      <div class="mt-4 pt-3 border-t border-gray-100">
        <p>
          For the complete technical specification, check out <a href="https://eips.ethereum.org/EIPS/eip-7702" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-500">EIP-7702</a>, or see viem's <a href="https://viem.sh/experimental/eip7702" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-500">implementation docs</a>.
        </p>
      </div>
    </div>
  </div>
</div>
