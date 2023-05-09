// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./Users.sol";
import "./Outfit.sol";
import "./Marketplace.sol";
error Auction__NotOwnerOfContract(address user);
error Auction__OwnerOfOutfit(address user, uint256 outfitId);
error Auction__NotOwnerOfOutfit(address user, uint256 outfitId);

error Auction__OutfitDoesNotExist(uint256 outfitId);

error Auction__AlreadyOnSell(uint256 outfitId);
error Auction__AlreadyOnAuction(uint256 outfitId);
error Auction__NotOnAuction(uint256 outfitId);

error Auction__NotValidPrice(uint256 price);
error Auction__NotEnoughUsableBalance(address user, uint256 requiredBalance);

error Auction__NotValidTimeStamp(uint256 endTimestamp, uint256 blockTimestamp);
error Auction__EndTimeHasNotPassed(
    uint256 endTimestamp,
    uint256 blockTimestamp
);

error Auction__NotValidBid(uint256 outfitId, uint256 maxBid, uint256 bidAmount);

contract Auction {
    // ================================ Events ================================
    event OutfitOnAuction(
        address user,
        address _outfit,
        uint256 outfitId,
        uint256 basePrice,
        uint256 endTimestamp
    );

    event AuctionBid(uint256 outfitId, address user, uint256 bidAmount);
    event AuctionEnded(uint256 outfitId, address winner, uint256 winningBid);
    event AuctionDeleted(uint256 outfitId);

    // ============================ State Variables ===========================
    struct AuctionItem {
        address seller;
        uint256 basePrice;
        uint256 endTimestamp;
        address[] bidders;
        mapping(address => uint256) bids;
    }

    Users private _users;
    Outfit private _outfit;
    Marketplace private _marketplace;

    address private _owner;
    mapping(uint256 => AuctionItem) private _auctions;

    // ============================== Modifiers ===============================
    modifier isOwner() {
        if (_owner != msg.sender)
            revert Auction__NotOwnerOfContract(msg.sender);
        _;
    }

    modifier isOwnerOfOutfit(uint256 outfitId, bool _is) {
        if (_is && msg.sender != _outfit.ownerOf(outfitId))
            revert Auction__NotOwnerOfOutfit(msg.sender, outfitId);
        else if (!_is && msg.sender == _outfit.ownerOf(outfitId))
            revert Auction__OwnerOfOutfit(msg.sender, outfitId);
        _;
    }

    modifier outfitExists(uint256 outfitId) {
        if (!_outfit.exists(outfitId))
            revert Auction__OutfitDoesNotExist(outfitId);
        _;
    }

    modifier onAuction(uint256 outfitId, bool _is) {
        if (_is && !isOutfitOnAuction(outfitId))
            revert Auction__NotOnAuction(outfitId);
        else if (!_is && isOutfitOnAuction(outfitId))
            revert Auction__AlreadyOnAuction(outfitId);
        _;
    }

    modifier notOnStore(uint256 outfitId) {
        if (_marketplace.isOutfitOnSell(outfitId)) {
            revert Auction__AlreadyOnSell(outfitId);
        }
        _;
    }

    modifier hasEnoughUsableBalance(uint256 requiredBalance) {
        if (_users.getUsableBalance(msg.sender) < requiredBalance)
            revert Auction__NotEnoughUsableBalance(msg.sender, requiredBalance);
        _;
    }

    modifier isValidTimeStamp(uint256 timestamp) {
        if (timestamp < block.timestamp) {
            revert Auction__NotValidTimeStamp(timestamp, block.timestamp);
        }
        _;
    }

    modifier isValidAmount(uint256 price) {
        if (price <= 0) revert Auction__NotValidPrice(price);
        _;
    }

    modifier isValidBid(uint256 outfitId, uint256 bidAmount) {
        uint256 maxBid = _getMaxBid(outfitId);
        // checking if bidAmount is less than or equal to max bid
        if (maxBid >= bidAmount) {
            revert Auction__NotValidBid(outfitId, maxBid, bidAmount);
        }
        _;
    }

    modifier didEndTimePassed(uint256 outfitId) {
        if (_auctions[outfitId].endTimestamp > block.timestamp) {
            revert Auction__EndTimeHasNotPassed(
                _auctions[outfitId].endTimestamp,
                block.timestamp
            );
        }
        _;
    }

    // ================================ Admin =================================
    constructor() {
        _owner = msg.sender;
    }

    function setOutfitContract(address newAddress) external isOwner {
        _outfit = Outfit(newAddress);
    }

    function setUsersContract(address newAddress) external isOwner {
        _users = Users(newAddress);
    }

    function setMarketplaceContract(address newAddress) external isOwner {
        _marketplace = Marketplace(newAddress);
    }

    // =============================== Getters ================================
    function isOutfitOnAuction(uint256 outfitId) public view returns (bool) {
        return _auctions[outfitId].basePrice != 0;
    }

    struct AuctionReturnItem {
        address seller;
        uint256 basePrice;
        uint256 endTimestamp;
        address[] bidders;
        uint256[] bids;
    }

    function getOutfitEntry(
        uint256 outfitId
    )
        public
        view
        outfitExists(outfitId)
        onAuction(outfitId, true)
        returns (AuctionReturnItem memory ret)
    {
        AuctionItem storage auction = _auctions[outfitId];

        uint256 len = auction.bidders.length;
        uint256[] memory bids = new uint256[](len);

        for (uint256 index = 0; index < len; index++) {
            bids[index] = auction.bids[auction.bidders[index]];
        }

        ret = AuctionReturnItem(
            auction.seller,
            auction.basePrice,
            auction.endTimestamp,
            auction.bidders,
            bids
        );
    }

    function _getMaxBid(uint256 outfitId) public view returns (uint256 maxBid) {
        AuctionItem storage _auction = _auctions[outfitId];

        maxBid = _auction.basePrice;
        // finding current maximum bid
        for (uint256 index = 0; index < _auction.bidders.length; index++) {
            if (maxBid < _auction.bids[_auction.bidders[index]]) {
                maxBid = _auction.bids[_auction.bidders[index]];
            }
        }
    }

    function _getMaxBidder(
        uint256 outfitId
    ) public view returns (address maxBidder) {
        AuctionItem storage _auction = _auctions[outfitId];

        if (_auction.bidders.length == 0) return address(0);

        uint256 maxBid = _auction.basePrice;
        // finding current maximum bid
        for (uint256 index = 0; index < _auction.bidders.length; index++) {
            if (maxBid < _auction.bids[_auction.bidders[index]]) {
                maxBid = _auction.bids[_auction.bidders[index]];
                maxBidder = _auction.bidders[index];
            }
        }
    }

    // ============================== Functions ===============================
    function putOnAuction(
        uint256 outfitId,
        uint256 basePrice,
        uint256 endTimestamp
    )
        external
        outfitExists(outfitId)
        isOwnerOfOutfit(outfitId, true)
        onAuction(outfitId, false)
        notOnStore(outfitId)
        isValidAmount(basePrice)
        isValidTimeStamp(endTimestamp)
    {
        // adding item in auction list
        AuctionItem storage _auction = _auctions[outfitId];
        _auction.seller = msg.sender;
        _auction.basePrice = basePrice;
        _auction.endTimestamp = endTimestamp;

        emit OutfitOnAuction(
            msg.sender,
            address(_outfit),
            outfitId,
            basePrice,
            endTimestamp
        );
    }

    function bidOnAuction(
        uint256 outfitId,
        uint256 bidAmount
    )
        external
        outfitExists(outfitId)
        isOwnerOfOutfit(outfitId, false)
        isValidBid(outfitId, bidAmount)
        hasEnoughUsableBalance(bidAmount)
    {
        // update user balance
        uint256 previousBid = _auctions[outfitId].bids[msg.sender];
        _users._addOutstandingBalance(msg.sender, bidAmount - previousBid);

        // update auction details
        // check if bidder's entry already exist or not
        if (previousBid == 0) _auctions[outfitId].bidders.push(msg.sender);
        _auctions[outfitId].bids[msg.sender] = bidAmount;

        emit AuctionBid(outfitId, msg.sender, bidAmount);
    }

    function endAuction(
        uint256 outfitId
    ) external outfitExists(outfitId) didEndTimePassed(outfitId) {
        AuctionItem storage auction = _auctions[outfitId];

        address seller = _auctions[outfitId].seller;
        address winner = _getMaxBidder(outfitId);
        uint256 maxBid = _getMaxBid(outfitId);

        // transfer ownership of outfit
        _outfit.safeTransferFrom(seller, winner, outfitId);

        // update winner profile
        _users._addOutfit(winner, outfitId);
        _users._removeBalance(winner, maxBid);

        // update seller profile
        _users._removeOutfit(seller, outfitId);
        _users._addBalance(seller, maxBid);

        // return balance to all bidders
        for (uint256 index = 0; index < auction.bidders.length; index++) {
            address bidder = auction.bidders[index];
            _users._removeOutstandingBalance(bidder, auction.bids[bidder]);
        }

        emit AuctionEnded(outfitId, winner, maxBid);
    }

    function removeFromAuction(
        uint256 outfitId
    )
        external
        outfitExists(outfitId)
        isOwnerOfOutfit(outfitId, true)
        onAuction(outfitId, true)
    {
        AuctionItem storage auction = _auctions[outfitId];

        // return balance to all bidders
        for (uint256 index = 0; index < auction.bidders.length; index++) {
            address bidder = auction.bidders[index];
            _users._removeOutstandingBalance(bidder, auction.bids[bidder]);
        }

        // deleting the entry
        delete _auctions[outfitId];

        emit AuctionDeleted(outfitId);
    }
}
