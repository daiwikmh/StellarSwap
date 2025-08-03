// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EthereumHTLC
 * @dev Hash Time Locked Contract for cross-chain swaps between Ethereum and Stellar
 * @notice This contract enables atomic swaps between Ethereum and Stellar networks
 */
contract EthereumHTLC is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Swap {
        address payable sender;      // Resolver's Ethereum address
        address payable receiver;    // User's Ethereum address  
        address tokenAddress;        // ERC20 contract (0x0 for ETH)
        uint256 amount;              // Amount locked
        bytes32 hashlock;            // Same SHA-256 hash as Stellar
        uint256 timelock;            // Expiration timestamp (LONGER than Stellar)
        bool claimed;                // Prevents double-claiming
        string stellarDestination;   // User's Stellar address
        string stellarSwapId;        // Reference to Stellar HTLC
    }

    mapping(bytes32 => Swap) public swaps;

    // Events that mirror Stellar contract events
    event SwapInitiated(
        bytes32 indexed swapId,
        address indexed sender,
        address indexed receiver,
        address tokenAddress,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        string stellarDestination
    );

    event SwapClaimed(
        bytes32 indexed swapId,
        bytes preimage,
        address claimer
    );

    event SwapRefunded(
        bytes32 indexed swapId,
        address refunder
    );

    /**
     * @dev Create HTLC (called by resolver)
     * @param _receiver User's Ethereum address to receive tokens
     * @param _tokenAddress Token contract address (0x0 for ETH)
     * @param _amount Amount to lock
     * @param _hashlock Hash of the secret (same as Stellar HTLC)
     * @param _timelock Expiration timestamp (must be later than Stellar timelock)
     * @param _stellarDestination User's Stellar address
     * @param _stellarSwapId Reference to corresponding Stellar HTLC
     * @return swapId Generated swap identifier
     */
    function initiate(
        address payable _receiver,
        address _tokenAddress,        
        uint256 _amount,
        bytes32 _hashlock,           
        uint256 _timelock,           
        string memory _stellarDestination,
        string memory _stellarSwapId
    ) external payable nonReentrant returns (bytes32 swapId) {
        
        require(_receiver != address(0), "Invalid receiver");
        require(_amount > 0, "Amount must be positive");
        require(_timelock > block.timestamp, "Timelock must be in future");
        require(bytes(_stellarDestination).length > 0, "Need Stellar destination");

        // Generate deterministic swap ID
        swapId = keccak256(abi.encodePacked(
            msg.sender,
            _receiver,
            _tokenAddress,
            _amount,
            _hashlock,
            _timelock,
            block.timestamp
        ));

        require(swaps[swapId].sender == address(0), "Swap already exists");

        // Handle token transfers
        if (_tokenAddress == address(0)) {
            // ETH transfer
            require(msg.value == _amount, "Incorrect ETH amount");
        } else {
            // ERC20 transfer
            require(msg.value == 0, "Don't send ETH for token swaps");
            IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        }

        // Store swap data
        swaps[swapId] = Swap({
            sender: payable(msg.sender),
            receiver: _receiver,
            tokenAddress: _tokenAddress,
            amount: _amount,
            hashlock: _hashlock,
            timelock: _timelock,
            claimed: false,
            stellarDestination: _stellarDestination,
            stellarSwapId: _stellarSwapId
        });

        emit SwapInitiated(
            swapId,
            msg.sender,
            _receiver,
            _tokenAddress,
            _amount,
            _hashlock,
            _timelock,
            _stellarDestination
        );
    }

    /**
     * @dev Claim tokens with secret preimage
     * @param _swapId Swap identifier
     * @param _preimage Secret that hashes to the hashlock
     */
    function claim(
        bytes32 _swapId,
        string memory _preimage
    ) external nonReentrant {
        Swap storage swap = swaps[_swapId];
        
        require(swap.sender != address(0), "Swap not found");
        require(!swap.claimed, "Swap already claimed");
        require(block.timestamp < swap.timelock, "Timelock expired");
        require(msg.sender == swap.receiver, "Only receiver can claim");

        // Verify preimage matches hashlock
        bytes32 preimageHash = sha256(abi.encodePacked(_preimage));
        require(preimageHash == swap.hashlock, "Invalid preimage");

        // Mark as claimed
        swap.claimed = true;

        // Transfer tokens to receiver
        if (swap.tokenAddress == address(0)) {
            // Transfer ETH
            swap.receiver.transfer(swap.amount);
        } else {
            // Transfer ERC20
            IERC20(swap.tokenAddress).safeTransfer(swap.receiver, swap.amount);
        }

        emit SwapClaimed(_swapId, abi.encodePacked(_preimage), msg.sender);
    }

    /**
     * @dev Refund tokens after timeout
     * @param _swapId Swap identifier
     */
    function refund(bytes32 _swapId) external nonReentrant {
        Swap storage swap = swaps[_swapId];
        
        require(swap.sender != address(0), "Swap not found");
        require(!swap.claimed, "Swap already claimed");
        require(block.timestamp >= swap.timelock, "Timelock not expired");
        require(msg.sender == swap.sender, "Only sender can refund");

        swap.claimed = true;

        if (swap.tokenAddress == address(0)) {
            swap.sender.transfer(swap.amount);
        } else {
            // Refund ERC20
            IERC20(swap.tokenAddress).safeTransfer(swap.sender, swap.amount);
        }

        emit SwapRefunded(_swapId, msg.sender);
    }

    /**
     * @dev Get swap details
     * @param _swapId Swap identifier
     * @return Swap details
     */
    function getSwap(bytes32 _swapId) external view returns (Swap memory) {
        return swaps[_swapId];
    }

    /**
     * @dev Check if preimage is valid for swap
     * @param _swapId Swap identifier
     * @param _preimage Secret to verify
     * @return True if preimage is valid
     */
    function verifyPreimage(
        bytes32 _swapId, 
        string memory _preimage
    ) external view returns (bool) {
        bytes32 preimageHash = sha256(abi.encodePacked(_preimage));
        return preimageHash == swaps[_swapId].hashlock;
    }

    /**
     * @dev Get multiple swap details at once
     * @param _swapIds Array of swap identifiers
     * @return Array of swap details
     */
    function getSwapsBatch(bytes32[] memory _swapIds) external view returns (Swap[] memory) {
        Swap[] memory result = new Swap[](_swapIds.length);
        for (uint256 i = 0; i < _swapIds.length; i++) {
            result[i] = swaps[_swapIds[i]];
        }
        return result;
    }

    /**
     * @dev Check if swap exists
     * @param _swapId Swap identifier
     * @return True if swap exists
     */
    function swapExists(bytes32 _swapId) external view returns (bool) {
        return swaps[_swapId].sender != address(0);
    }
}