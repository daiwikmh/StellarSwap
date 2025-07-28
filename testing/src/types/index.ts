export interface CrossChainSwap {
  id: string;
  direction: 'eth-to-stellar' | 'stellar-to-eth';
  fromAmount: bigint;
  toAmount: bigint;
  userEthAddress: string;
  userStellarAddress: string;
  secret: string;
  hashlock: string;
  ethereumTimelock: number;
  stellarTimelock: number;
  status: 'initiated' | 'locked' | 'claimed' | 'completed' | 'failed';
  ethereumSwapId?: string;
  stellarSwapId?: string;
}

export interface SwapEvent {
  type: 'initiated' | 'claimed' | 'refunded';
  swapId: string;
  transactionHash: string;
  blockNumber?: number;
  timestamp: number;
  preimage?: string;
}

export interface EthereumSwap {
  sender: string;
  receiver: string;
  tokenAddress: string;
  amount: bigint;
  hashlock: string;
  timelock: bigint;
  claimed: boolean;
  stellarDestination: string;
  stellarSwapId: string;
}

export interface SwapInitiatedEvent {
  swapId: string;
  sender: string;
  receiver: string;
  tokenAddress: string;
  amount: bigint;
  hashlock: string;
  timelock: bigint;
  stellarDestination: string;
}

export interface SwapClaimedEvent {
  swapId: string;
  preimage: string;
  claimer: string;
}

export interface SwapRefundedEvent {
  swapId: string;
  refunder: string;
}