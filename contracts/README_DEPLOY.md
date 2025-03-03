# BatchCallDelegation Contract Deployment

This README provides instructions on how to deploy the BatchCallDelegation contract to the Sepolia testnet using Foundry.

## Prerequisites

1. [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
2. An Ethereum wallet with some Sepolia ETH for gas
3. An RPC URL for the Sepolia testnet (e.g., from Infura)

## Setup

1. Clone this repository
2. Navigate to the contracts directory: `cd contracts`
3. Install dependencies: `forge install`
4. Create a `.env` file with the following variables:
   ```
   PRIVATE_KEY=your_private_key_here
   RPC_URL=your_sepolia_rpc_url_here
   ```
   Replace `your_private_key_here` with your wallet's private key (without the 0x prefix)
   Replace `your_sepolia_rpc_url_here` with your Sepolia RPC URL

## Deployment

To deploy the BatchCallDelegation contract to Sepolia:

```bash
forge script script/BatchCallDelegation.s.sol:BatchCallDelegationScript --rpc-url $RPC_URL --broadcast --verify
```

This command will:
1. Compile the contract
2. Deploy it to the Sepolia testnet
3. Output the contract address in the console

## Verification

To verify the contract on Etherscan, you'll need an Etherscan API key. Add it to your `.env` file:

```
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

Then run:

```bash
forge verify-contract <DEPLOYED_CONTRACT_ADDRESS> src/BatchCallDelegation.sol:BatchCallDelegation --chain-id 11155111 --watch
```

Replace `<DEPLOYED_CONTRACT_ADDRESS>` with the address of your deployed contract.

## Using the Contract

Once deployed, you can interact with the contract using the frontend application. The contract address will need to be added to your frontend configuration. 