import { createWalletClient, http, createPublicClient, getContract } from 'viem';
import { holesky } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ETHEREUM_HTLC_ABI } from './abi';

// Environment variables - these should be set in your .env file
export const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL;
export const ETHEREUM_HTLC_ADDRESS = process.env.ETHEREUM_HTLC_ADDRESS;
export const ETHEREUM_RELAYER_PRIVATE_KEY = process.env.ETHEREUM_RELAYER_PRIVATE_KEY ;
export const ETH_RECEIVER_PRIVATE_KEY = process.env.ETH_RECEIVER_PRIVATE_KEY;

// Use Sepolia testnet for development
const chain = holesky;

// Create public client for reading contract state
export const publicClient = createPublicClient({
  chain,
  transport: http(ETHEREUM_RPC_URL),
});

// Create wallet clients for different roles
// if (!ETHEREUM_RELAYER_PRIVATE_KEY) {
//   throw new Error('ETHEREUM_RELAYER_PRIVATE_KEY is not set in environment variables');
// }
// if (!ETH_RECEIVER_PRIVATE_KEY) {
//   throw new Error('ETH_RECEIVER_PRIVATE_KEY is not set in environment variables');
// }

export const relayerAccount = privateKeyToAccount(ETHEREUM_RELAYER_PRIVATE_KEY as `0x${string}`);
export const receiverAccount = privateKeyToAccount(ETH_RECEIVER_PRIVATE_KEY as `0x${string}`);

export const relayerWalletClient = createWalletClient({
  account: relayerAccount,
  chain:holesky,
  transport: http(ETHEREUM_RPC_URL),
});

export const receiverWalletClient = createWalletClient({
  account: receiverAccount,
  chain: holesky,
  transport: http(ETHEREUM_RPC_URL),
});

// EthereumHTLC contract ABI


// Contract instance for reading
if (!ETHEREUM_HTLC_ADDRESS) {
  throw new Error('ETHEREUM_HTLC_ADDRESS is not set in environment variables');
}
export const ethereumHTLCContract = getContract({
  address: ETHEREUM_HTLC_ADDRESS as `0x${string}`,
  abi: ETHEREUM_HTLC_ABI,
  client: publicClient,
});