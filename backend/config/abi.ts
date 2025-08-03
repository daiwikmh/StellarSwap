export const ETHEREUM_HTLC_ABI = [
  {
    "type": "function",
    "name": "initiate",
    "inputs": [
      {"name": "_receiver", "type": "address"},
      {"name": "_tokenAddress", "type": "address"},
      {"name": "_amount", "type": "uint256"},
      {"name": "_hashlock", "type": "bytes32"},
      {"name": "_timelock", "type": "uint256"},
      {"name": "_stellarDestination", "type": "string"},
      {"name": "_stellarSwapId", "type": "string"}
    ],
    "outputs": [{"name": "swapId", "type": "bytes32"}],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      {"name": "_swapId", "type": "bytes32"},
      {"name": "_preimage", "type": "string"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "refund",
    "inputs": [
      {"name": "_swapId", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getSwap",
    "inputs": [
      {"name": "_swapId", "type": "bytes32"}
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {"name": "sender", "type": "address"},
          {"name": "receiver", "type": "address"},
          {"name": "tokenAddress", "type": "address"},
          {"name": "amount", "type": "uint256"},
          {"name": "hashlock", "type": "bytes32"},
          {"name": "timelock", "type": "uint256"},
          {"name": "claimed", "type": "bool"},
          {"name": "stellarDestination", "type": "string"},
          {"name": "stellarSwapId", "type": "string"}
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "verifyPreimage",
    "inputs": [
      {"name": "_swapId", "type": "bytes32"},
      {"name": "_preimage", "type": "string"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "swaps",
    "inputs": [
      {"name": "", "type": "bytes32"}
    ],
    "outputs": [
      {"name": "sender", "type": "address"},
      {"name": "receiver", "type": "address"},
      {"name": "tokenAddress", "type": "address"},
      {"name": "amount", "type": "uint256"},
      {"name": "hashlock", "type": "bytes32"},
      {"name": "timelock", "type": "uint256"},
      {"name": "claimed", "type": "bool"},
      {"name": "stellarDestination", "type": "string"},
      {"name": "stellarSwapId", "type": "string"}
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "SwapInitiated",
    "inputs": [
      {"name": "swapId", "type": "bytes32", "indexed": true},
      {"name": "sender", "type": "address", "indexed": true},
      {"name": "receiver", "type": "address", "indexed": true},
      {"name": "tokenAddress", "type": "address", "indexed": false},
      {"name": "amount", "type": "uint256", "indexed": false},
      {"name": "hashlock", "type": "bytes32", "indexed": false},
      {"name": "timelock", "type": "uint256", "indexed": false},
      {"name": "stellarDestination", "type": "string", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "SwapClaimed",
    "inputs": [
      {"name": "swapId", "type": "bytes32", "indexed": true},
      {"name": "preimage", "type": "bytes", "indexed": false},
      {"name": "claimer", "type": "address", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "SwapRefunded",
    "inputs": [
      {"name": "swapId", "type": "bytes32", "indexed": true},
      {"name": "refunder", "type": "address", "indexed": false}
    ]
  }
] as const;