// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title HTLCPredicate
 * @dev Predicate contract for 1inch Limit Order Protocol that validates HTLC preimages
 * @notice This contract enforces that orders can only be filled with the correct preimage
 */
contract HTLCPredicate {
    
    struct HTLCOrder {
        bytes32 hashlock;           // Hash of the secret (keccak256)
        uint256 timelock;           // Expiration timestamp
        address stellarReceiver;    // Reference to Stellar receiver (for events)
    }
    
    // Store HTLC data for each order
    mapping(bytes32 => HTLCOrder) public htlcOrders;
    
    event HTLCOrderCreated(
        bytes32 indexed orderHash,
        bytes32 indexed hashlock,
        uint256 timelock,
        address stellarReceiver
    );
    
    event HTLCOrderFilled(
        bytes32 indexed orderHash,
        bytes32 indexed hashlock,
        bytes preimage
    );

    /**
     * @dev Register HTLC parameters for a specific order hash
     * @param orderHash Hash of the 1inch limit order
     * @param hashlock keccak256 hash of the secret
     * @param timelock Expiration timestamp
     * @param stellarReceiver Stellar address (for reference/events)
     */
    function registerHTLCOrder(
        bytes32 orderHash,
        bytes32 hashlock,
        uint256 timelock,
        address stellarReceiver
    ) external {
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(timelock > block.timestamp, "Timelock must be in future");
        require(htlcOrders[orderHash].hashlock == bytes32(0), "Order already registered");
        
        htlcOrders[orderHash] = HTLCOrder({
            hashlock: hashlock,
            timelock: timelock,
            stellarReceiver: stellarReceiver
        });
        
        emit HTLCOrderCreated(orderHash, hashlock, timelock, stellarReceiver);
    }

    /**
     * @dev Main predicate function called by 1inch LOP
     * @param orderHash Hash of the order being filled
     * @param preimage The secret preimage provided by taker
     * @return 1 if predicate passes, 0 if it fails
     */
    function validateHTLC(
        bytes32 orderHash,
        bytes calldata preimage
    ) external view returns (uint256) {
        return _validateHTLC(orderHash, preimage);
    }

    /**
     * @dev Internal validation logic
     * @param orderHash Hash of the order being filled
     * @param preimage The secret preimage provided by taker
     * @return 1 if predicate passes, 0 if it fails
     */
    function _validateHTLC(
        bytes32 orderHash,
        bytes calldata preimage
    ) internal view returns (uint256) {
        HTLCOrder memory htlcOrder = htlcOrders[orderHash];
        
        // Check if HTLC order is registered
        if (htlcOrder.hashlock == bytes32(0)) {
            return 0; // Order not registered
        }
        
        // Check timelock
        if (block.timestamp >= htlcOrder.timelock) {
            return 0; // Order expired
        }
        
        // Validate preimage against hashlock
        bytes32 preimageHash = keccak256(preimage);
        if (preimageHash != htlcOrder.hashlock) {
            return 0; // Invalid preimage
        }
        
        return 1; // Predicate passes
    }

    /**
     * @dev Predicate function with automatic order hash derivation
     * @param maker Address of the order maker
     * @param makerAsset Address of maker asset
     * @param takerAsset Address of taker asset  
     * @param makingAmount Amount being made
     * @param takingAmount Amount being taken
     * @param preimage The secret preimage
     * @return 1 if predicate passes, 0 if it fails
     */
    function validateHTLCWithParams(
        address maker,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes calldata preimage
    ) external view returns (uint256) {
        // Derive order hash from parameters (simplified)
        bytes32 orderHash = keccak256(abi.encodePacked(
            maker,
            makerAsset,
            takerAsset,
            makingAmount,
            takingAmount
        ));
        
        return _validateHTLC(orderHash, preimage);
    }

    /**
     * @dev Combined predicate that validates HTLC and logs the fill
     * @param orderHash Hash of the order
     * @param preimage The secret preimage
     * @return 1 if predicate passes, 0 if it fails
     */
    function validateAndLogHTLC(
        bytes32 orderHash,
        bytes calldata preimage
    ) external returns (uint256) {
        uint256 result = _validateHTLC(orderHash, preimage);
        
        // Log successful fill if validation passed
        if (result == 1) {
            HTLCOrder memory htlcOrder = htlcOrders[orderHash];
            emit HTLCOrderFilled(orderHash, htlcOrder.hashlock, preimage);
        }
        
        return result;
    }

    /**
     * @dev Get HTLC order details
     * @param orderHash Hash of the order
     * @return HTLCOrder details
     */
    function getHTLCOrder(bytes32 orderHash) external view returns (HTLCOrder memory) {
        return htlcOrders[orderHash];
    }

    /**
     * @dev Check if order can be filled with given preimage (view function)
     * @param orderHash Hash of the order
     * @param preimage The secret preimage
     * @return canFill True if order can be filled
     */
    function canFillOrder(
        bytes32 orderHash,
        bytes calldata preimage
    ) external view returns (bool canFill) {
        return _validateHTLC(orderHash, preimage) == 1;
    }

    /**
     * @dev Batch check multiple orders
     * @param orderHashes Array of order hashes
     * @param preimages Array of preimages
     * @return results Array of validation results
     */
    function batchValidateHTLC(
        bytes32[] calldata orderHashes,
        bytes[] calldata preimages
    ) external view returns (uint256[] memory results) {
        require(orderHashes.length == preimages.length, "Array length mismatch");
        
        results = new uint256[](orderHashes.length);
        for (uint256 i = 0; i < orderHashes.length; i++) {
            results[i] = _validateHTLC(orderHashes[i], preimages[i]);
        }
    }
}