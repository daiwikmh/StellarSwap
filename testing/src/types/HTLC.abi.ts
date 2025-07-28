export const ETHEREUM_HTLC_ABI = [
  // WRITE FUNCTIONS
 
  {
    "type": "function",
    "name": "initiate",
    "inputs": [
      { "name": "_receiver", "type": "address", "internalType": "address payable" },
      { "name": "_tokenAddress", "type": "address", "internalType": "address" },
      { "name": "_amount", "type": "uint256", "internalType": "uint256" },
      { "name": "_hashlock", "type": "bytes32", "internalType": "bytes32" },
      { "name": "_timelock", "type": "uint256", "internalType": "uint256" },
      { "name": "_stellarDestination", "type": "string", "internalType": "string" },
      { "name": "_stellarSwapId", "type": "string", "internalType": "string" }
    ],
    "outputs": [
      { "name": "swapId", "type": "bytes32", "internalType": "bytes32" }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      { "name": "_swapId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "_preimage", "type": "string", "internalType": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", 
    "name": "refund",
    "inputs": [
      { "name": "_swapId", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },

  // READ FUNCTIONS
  {
    "type": "function",
    "name": "getSwap",
    "inputs": [
      { "name": "_swapId", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct EthereumHTLC.Swap",
        "components": [
          { "name": "sender", "type": "address", "internalType": "address payable" },
          { "name": "receiver", "type": "address", "internalType": "address payable" },
          { "name": "tokenAddress", "type": "address", "internalType": "address" },
          { "name": "amount", "type": "uint256", "internalType": "uint256" },
          { "name": "hashlock", "type": "bytes32", "internalType": "bytes32" },
          { "name": "timelock", "type": "uint256", "internalType": "uint256" },
          { "name": "claimed", "type": "bool", "internalType": "bool" },
          { "name": "stellarDestination", "type": "string", "internalType": "string" },
          { "name": "stellarSwapId", "type": "string", "internalType": "string" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "verifyPreimage",
    "inputs": [
      { "name": "_swapId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "_preimage", "type": "string", "internalType": "string" }
    ],
    "outputs": [
      { "name": "", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "swaps",
    "inputs": [
      { "name": "", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [
      { "name": "sender", "type": "address", "internalType": "address payable" },
      { "name": "receiver", "type": "address", "internalType": "address payable" },
      { "name": "tokenAddress", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" },
      { "name": "hashlock", "type": "bytes32", "internalType": "bytes32" },
      { "name": "timelock", "type": "uint256", "internalType": "uint256" },
      { "name": "claimed", "type": "bool", "internalType": "bool" },
      { "name": "stellarDestination", "type": "string", "internalType": "string" },
      { "name": "stellarSwapId", "type": "string", "internalType": "string" }
    ],
    "stateMutability": "view"
  },

  // EVENTS
  {
    "type": "event",
    "name": "SwapInitiated",
    "inputs": [
      { "name": "swapId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "sender", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "receiver", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "tokenAddress", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "hashlock", "type": "bytes32", "indexed": false, "internalType": "bytes32" },
      { "name": "timelock", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "stellarDestination", "type": "string", "indexed": false, "internalType": "string" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SwapClaimed",
    "inputs": [
      { "name": "swapId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "preimage", "type": "bytes", "indexed": false, "internalType": "bytes" },
      { "name": "claimer", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SwapRefunded",
    "inputs": [
      { "name": "swapId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "refunder", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  }
] as const;