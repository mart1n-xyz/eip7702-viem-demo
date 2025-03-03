# EIP-7702 Batch Transfer Demo

> ⚠️ **Important Notice**: This is an experimental implementation of EIP-7702. Currently, no wallets fully support EIP-7702, and RPC provider support is limited. 

This project demonstrates the implementation of [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) for batch ETH transfers using viem's experimental features. It implements the examples from [viem docs](https://viem.sh/experimental/eip7702/contract-writes) that allows users to send ETH to multiple recipients in a single transaction, leveraging account abstraction without deploying a smart contract.

## Features

- 🔄 Batch transfer ETH to multiple recipients in one transaction
- 🔌 Supports both Sepolia and Holesky testnets
- 🛡️ Implements EIP-7702 with multiple fallback methods
- 🎨 Clean, modern UI with real-time feedback
- 📝 Detailed activity logging
- 🔄 Automatic network switching
- 💼 MetaMask and other web3 wallet support

## Live Demo

Try it out at [demo URL]

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

1. **Authorization**: When initiating a batch transfer, your wallet signs an authorization message allowing the BatchCallDelegation contract to act as an interface.

2. **Transaction Creation**: The signed authorization is included with your transaction data containing instructions for multiple transfers.

3. **Execution**: During processing, the EVM temporarily injects the BatchCallDelegation contract's code into your EOA's context.

4. **Batch Processing**: The contract's `execute()` function runs within your EOA's context, processing all transfers atomically.

## Technical Details

- Built with SvelteKit and Viem
- Uses Foundry for contract deployment
- Implements EIP-7702 with multiple fallback methods for wallet compatibility
- Supports both modern (EIP-7702 aware) and legacy wallets

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
