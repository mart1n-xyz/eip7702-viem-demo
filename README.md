# EIP-7702 Demo

 This project demonstrates the implementation of [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) using viem's experimental features.

> ⚠️ **Important Notice**: This is an experimental implementation of EIP-7702. Currently, wallet and RPC provider support is limited. The demo uses Alchemy, but your wallet might override this.

## What's EIP-7702?

EIP-7702 is one of the most exciting Ethereum improvements in a while. It lets your regular wallet (EOA) temporarily gain smart contract superpowers!

Imagine your wallet could:
- **Do multiple things in one go** - Like sending tokens to 10 people at once, saving you gas and time
- **Let someone else pay gas fees for you** - Perfect for onboarding new users who don't have ETH yet

Without EIP-7702, you'd need to deploy an actual smart contract wallet to do any of this. Now your regular wallet can have these powers temporarily, exactly when needed!

*Technically speaking: EIP-7702 introduces a new transaction type (0x04) with a delegation mechanism that injects contract code into your EOA's execution context.*

## Demo Tools

This demo provides two ways to explore EIP-7702:

### 👉 Batch Transfer Example

See EIP-7702 in action with the example from viem's docs! Send ETH to multiple recipients in a single transaction - something normally impossible with a regular wallet.

- 🔄 Batch transfer ETH to multiple recipients in one transaction
- 📝 Detailed activity logging and real-time feedback
- 🛡️ Simple, focused implementation of the viem example

### 🛠️ Transaction Builder

The real power tool! Test EIP-7702 with *any* contract of your choice. Just paste a contract address, select a function, and our tool will handle the EIP-7702 transaction setup for you.

- 📄 ABI detection and function parsing
- 🎮 Dynamic form generation for any contract function
- 📱 Visual transaction builder and previewer
- 🔍 Transaction status tracking and error handling

## Features

- 🔌 Supports both Sepolia and Holesky testnets

- 💼 MetaMask and other web3 wallet support (once they ship it)

## Live Demo

Try it out at [https://eip7702demo.netlify.app/]

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/eip7702-viem-demo.git
cd eip7702-viem-demo
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Alchemy API key:
```bash
VITE_ALCHEMY_API_KEY=your_alchemy_api_key
```

4. Start the development server:
```bash
npm run dev
```

## Contract Deployment

The BatchCallDelegation contract is deployed at:
- Sepolia: `0x6987E30398b2896B5118ad1076fb9f58825a6f1a`
- Holesky: `0x979dd1ab4a7e3b3370b1daceec8b4198f97e0d6f`

To deploy to a different network:
```bash
forge script script/Deploy.s.sol --rpc-url your_rpc_url --broadcast
```

## How It Works

1. **Authorization**: When initiating a transaction, your wallet signs an authorization message allowing the contract to act as an interface.

2. **Transaction Creation**: The signed authorization is included with your transaction data containing the instructions.

3. **Execution**: During processing, the EVM temporarily injects the contract's code into your EOA's context.

4. **Processing**: The contract's functions run within your EOA's context, executing all operations atomically.

## Technical Details

- Built with SvelteKit and Viem
- Uses Foundry for contract deployment
- Implements EIP-7702 with multiple fallback methods for wallet compatibility


## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy contracts (requires Foundry)
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- [Viem](https://viem.sh) for their experimental EIP-7702 implementation
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) authors and contributors
