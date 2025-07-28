import  {ETHEREUM_HTLC_ABI}  from '../types/HTLC.abi';

export const CONTRACTS = {
  ethereum: {
    address: import.meta.env.ETHEREUM_HTLC_ADDRESS,
    rpcUrl: import.meta.env.ETHEREUM_RPC_URL,
    network: import.meta.env.ETHEREUM_NETWORK,
    abi: ETHEREUM_HTLC_ABI,
  },
  stellar: {
    address: import.meta.env.STELLAR_HTLC_ADDRESS,
    network: import.meta.env.STELLAR_NETWORK,
    horizonUrl: import.meta.env.STELLAR_NETWORK
  }
};

export const RELAYER = {
  ethereum: {
    privateKey: import.meta.env.ETHEREUM_RELAYER_PRIVATE_KEY,
  },
  stellar: {
    secretKey: import.meta.env.STELLAR_RELAYER_SECRET,
  }
};