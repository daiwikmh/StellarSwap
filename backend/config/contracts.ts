import  {ETHEREUM_HTLC_ABI}  from '../types/HTLC.abi';

export const CONTRACTS = {
  ethereum: {
    address: process.env.ETHEREUM_HTLC_ADDRESS,
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    network: process.env.ETHEREUM_NETWORK,
    abi: ETHEREUM_HTLC_ABI,
  },
  stellar: {
    address: process.env.STELLAR_HTLC_ADDRESS,
    network: process.env.STELLAR_NETWORK,
    horizonUrl: process.env.STELLAR_NETWORK
  }
};

export const RELAYER = {
  ethereum: {
    privateKey: process.env.ETHEREUM_RELAYER_PRIVATE_KEY,
  },
  stellar: {
    secretKey: process.env.STELLAR_RELAYER_SECRET,
  }
};