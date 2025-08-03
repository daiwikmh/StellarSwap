// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../extensions/HTLCPredicate.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title StellarToEthereumBridge
 * @dev Bridge for transferring value from Stellar to Ethereum using HTLC + 1inch LOP
 * @notice Enables atomic swaps from XLM to ETH/ERC20 tokens
 */
contract StellarToEthereumBridge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct CrossChainSwap {
        bytes32 swapId;
        address payable ethereumReceiver;
        address tokenAddress;           // 0x0 for ETH, contract address for ERC20
        uint256 ethereumAmount;
        uint256 stellarAmount;
        bytes32 hashlock;
        uint256 timelock;
        string stellarSender;           // Stellar address as string
        string stellarTxHash;           // Stellar transaction hash
        SwapStatus status;
        uint256 createdAt;
        uint256 exchangeRate;           // Rate: stellarAmount / ethereumAmount
    }

    enum SwapStatus {
        PENDING,        // Swap created, waiting for Stellar confirmation
        STELLAR_LOCKED, // Stellar HTLC confirmed
        ETH_READY,      // Ethereum side ready for claim
        COMPLETED,      // Both sides claimed
        REFUNDED,       // Swap refunded/expired
        FAILED          // Swap failed
    }

    HTLCPredicate public immutable htlcPredicate;
    
    mapping(bytes32 => CrossChainSwap) public swaps;
    mapping(string => bytes32) public stellarTxToSwap; // Stellar TX hash -> swap ID
    
    uint256 public swapCounter;
    uint256 public constant MIN_TIMELOCK = 3600;  // 1 hour minimum
    uint256 public constant MAX_TIMELOCK = 86400; // 24 hours maximum
    
    // Supported tokens for swapping
    mapping(address => bool) public supportedTokens;
    
    event SwapInitiated(
        bytes32 indexed swapId,
        address indexed ethereumReceiver,
        address tokenAddress,
        uint256 ethereumAmount,
        uint256 stellarAmount,
        bytes32 hashlock,
        uint256 timelock,
        string stellarSender,
        uint256 exchangeRate
    );
    
    event StellarHTLCConfirmed(
        bytes32 indexed swapId,
        string stellarTxHash,
        uint256 timestamp
    );
    
    event SwapCompleted(
        bytes32 indexed swapId,
        string stellarClaimTx,
        bytes32 ethereumClaimTx,
        string preimage
    );
    
    event SwapRefunded(
        bytes32 indexed swapId,
        address refundRecipient,
        uint256 amount
    );

    constructor(address _htlcPredicate, address _owner) Ownable(_owner) {
        htlcPredicate = HTLCPredicate(_htlcPredicate);
        
        // Add ETH as supported token
        supportedTokens[address(0)] = true;
    }

    /**
     * @dev Initiate Stellar -> Ethereum swap
     * @param ethereumReceiver Address to receive tokens on Ethereum
     * @param tokenAddress Token to receive (0x0 for ETH)
     * @param ethereumAmount Amount to receive on Ethereum
     * @param stellarAmount Amount to send on Stellar
     * @param hashlock Hash of the secret
     * @param timelock Expiration timestamp
     * @param stellarSender Stellar address sending the funds
     */
    function initiateStellarToEthSwap(
        address payable ethereumReceiver,
        address tokenAddress,
        uint256 ethereumAmount,
        uint256 stellarAmount,
        bytes32 hashlock,
        uint256 timelock,
        string memory stellarSender
    ) external payable nonReentrant returns (bytes32 swapId) {
        require(ethereumReceiver != address(0), "Invalid receiver");
        require(ethereumAmount > 0, "Invalid Ethereum amount");
        require(stellarAmount > 0, "Invalid Stellar amount");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(timelock > block.timestamp + MIN_TIMELOCK, "Timelock too short");
        require(timelock < block.timestamp + MAX_TIMELOCK, "Timelock too long");
        require(supportedTokens[tokenAddress], "Token not supported");
        require(bytes(stellarSender).length > 0, "Invalid Stellar sender");

        // Calculate exchange rate (scaled by 1e18 for precision)
        uint256 exchangeRate = (stellarAmount * 1e18) / ethereumAmount;
        
        // Generate unique swap ID
        swapId = keccak256(abi.encodePacked(
            swapCounter++,
            ethereumReceiver,
            tokenAddress,
            ethereumAmount,
            stellarAmount,
            hashlock,
            block.timestamp
        ));

        // Handle ETH/ERC20 deposit
        if (tokenAddress == address(0)) {
            // ETH swap
            require(msg.value == ethereumAmount, "Incorrect ETH amount");
        } else {
            // ERC20 swap
            require(msg.value == 0, "Don't send ETH for token swaps");
            IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), ethereumAmount);
        }

        // Create swap record
        swaps[swapId] = CrossChainSwap({
            swapId: swapId,
            ethereumReceiver: ethereumReceiver,
            tokenAddress: tokenAddress,
            ethereumAmount: ethereumAmount,
            stellarAmount: stellarAmount,
            hashlock: hashlock,
            timelock: timelock,
            stellarSender: stellarSender,
            stellarTxHash: "",
            status: SwapStatus.PENDING,
            createdAt: block.timestamp,
            exchangeRate: exchangeRate
        });

        // Register with HTLC predicate
        htlcPredicate.registerHTLCOrder(
            swapId,
            hashlock,
            timelock,
            ethereumReceiver
        );

        emit SwapInitiated(
            swapId,
            ethereumReceiver,
            tokenAddress,
            ethereumAmount,
            stellarAmount,
            hashlock,
            timelock,
            stellarSender,
            exchangeRate
        );
    }

    /**
     * @dev Confirm Stellar HTLC has been created
     * @param swapId The swap identifier
     * @param stellarTxHash Stellar transaction hash
     */
    function confirmStellarHTLC(
        bytes32 swapId,
        string memory stellarTxHash
    ) external onlyOwner {
        CrossChainSwap storage swap = swaps[swapId];
        require(swap.swapId != bytes32(0), "Swap not found");
        require(swap.status == SwapStatus.PENDING, "Invalid status");
        require(bytes(stellarTxHash).length > 0, "Invalid Stellar TX hash");

        swap.stellarTxHash = stellarTxHash;
        swap.status = SwapStatus.STELLAR_LOCKED;
        stellarTxToSwap[stellarTxHash] = swapId;

        emit StellarHTLCConfirmed(swapId, stellarTxHash, block.timestamp);
    }

    /**
     * @dev Mark swap as ready for Ethereum claim
     * @param swapId The swap identifier
     */
    function markEthereumReady(bytes32 swapId) external onlyOwner {
        CrossChainSwap storage swap = swaps[swapId];
        require(swap.swapId != bytes32(0), "Swap not found");
        require(swap.status == SwapStatus.STELLAR_LOCKED, "Invalid status");

        swap.status = SwapStatus.ETH_READY;
    }

    /**
     * @dev Complete the swap by providing the preimage
     * @param swapId The swap identifier
     * @param preimage The secret that unlocks both HTLCs
     * @param stellarClaimTx Stellar claim transaction hash
     */
    function completeSwap(
        bytes32 swapId,
        string memory preimage,
        string memory stellarClaimTx
    ) external nonReentrant {
        CrossChainSwap storage swap = swaps[swapId];
        require(swap.swapId != bytes32(0), "Swap not found");
        require(swap.status == SwapStatus.ETH_READY, "Swap not ready");
        require(block.timestamp < swap.timelock, "Swap expired");
        require(msg.sender == swap.ethereumReceiver, "Only receiver can complete");

        // Verify preimage
        bytes32 preimageHash = keccak256(abi.encodePacked(preimage));
        require(preimageHash == swap.hashlock, "Invalid preimage");

        // Verify with HTLC predicate
        uint256 validation = htlcPredicate.validateHTLC(swapId, bytes(preimage));
        require(validation == 1, "HTLC validation failed");

        // Transfer tokens/ETH to receiver
        if (swap.tokenAddress == address(0)) {
            // Transfer ETH
            swap.ethereumReceiver.transfer(swap.ethereumAmount);
        } else {
            // Transfer ERC20
            IERC20(swap.tokenAddress).safeTransfer(swap.ethereumReceiver, swap.ethereumAmount);
        }

        swap.status = SwapStatus.COMPLETED;

        emit SwapCompleted(swapId, stellarClaimTx, bytes32(0), preimage);
    }

    /**
     * @dev Refund swap after timeout
     * @param swapId The swap identifier
     */
    function refundSwap(bytes32 swapId) external nonReentrant {
        CrossChainSwap storage swap = swaps[swapId];
        require(swap.swapId != bytes32(0), "Swap not found");
        require(swap.status != SwapStatus.COMPLETED, "Swap already completed");
        require(block.timestamp >= swap.timelock, "Swap not expired");

        // Refund tokens/ETH to contract owner (resolver)
        if (swap.tokenAddress == address(0)) {
            payable(owner()).transfer(swap.ethereumAmount);
        } else {
            IERC20(swap.tokenAddress).safeTransfer(owner(), swap.ethereumAmount);
        }

        swap.status = SwapStatus.REFUNDED;

        emit SwapRefunded(swapId, owner(), swap.ethereumAmount);
    }

    /**
     * @dev Add supported token
     * @param tokenAddress Token contract address
     */
    function addSupportedToken(address tokenAddress) external onlyOwner {
        supportedTokens[tokenAddress] = true;
    }

    /**
     * @dev Remove supported token
     * @param tokenAddress Token contract address
     */
    function removeSupportedToken(address tokenAddress) external onlyOwner {
        supportedTokens[tokenAddress] = false;
    }

    /**
     * @dev Get swap details
     * @param swapId The swap identifier
     * @return swap details
     */
    function getSwap(bytes32 swapId) external view returns (CrossChainSwap memory) {
        return swaps[swapId];
    }

    /**
     * @dev Get swap by Stellar transaction hash
     * @param stellarTxHash Stellar transaction hash
     * @return swap details
     */
    function getSwapByStellarTx(string memory stellarTxHash) external view returns (CrossChainSwap memory) {
        bytes32 swapId = stellarTxToSwap[stellarTxHash];
        return swaps[swapId];
    }

    /**
     * @dev Check if swap can be completed with preimage
     * @param swapId The swap identifier
     * @param preimage The secret preimage
     * @return canComplete True if swap can be completed
     */
    function canCompleteSwap(bytes32 swapId, string memory preimage) external view returns (bool canComplete) {
        CrossChainSwap memory swap = swaps[swapId];
        if (swap.swapId == bytes32(0)) return false;
        if (swap.status != SwapStatus.ETH_READY) return false;
        if (block.timestamp >= swap.timelock) return false;
        
        bytes32 preimageHash = keccak256(abi.encodePacked(preimage));
        return preimageHash == swap.hashlock;
    }

    /**
     * @dev Get active swaps for an address
     * @param ethereumReceiver Ethereum receiver address
     * @return swapIds Array of active swap IDs
     */
    function getActiveSwapsForAddress(address ethereumReceiver) external view returns (bytes32[] memory swapIds) {
        // This is a simplified version - in production, you'd maintain a mapping
        // For now, frontend can query events to get swap IDs
        bytes32[] memory result = new bytes32[](0);
        return result;
    }

    /**
     * @dev Calculate exchange rate for given amounts
     * @param stellarAmount Amount in Stellar (scaled by 1e7)
     * @param ethereumAmount Amount in Ethereum (scaled by 1e18)
     * @return rate Exchange rate (scaled by 1e18)
     */
    function calculateExchangeRate(uint256 stellarAmount, uint256 ethereumAmount) external pure returns (uint256 rate) {
        require(ethereumAmount > 0, "Invalid Ethereum amount");
        return (stellarAmount * 1e18) / ethereumAmount;
    }

    /**
     * @dev Emergency withdrawal function
     * @param tokenAddress Token to withdraw (0x0 for ETH)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address tokenAddress, uint256 amount) external onlyOwner {
        if (tokenAddress == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(tokenAddress).safeTransfer(owner(), amount);
        }
    }
}