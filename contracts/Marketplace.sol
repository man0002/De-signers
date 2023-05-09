// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./Outfit.sol";
import "./Auction.sol";
import "./Users.sol";

error Marketplace__NotOwner(address sender);
error Marketplace__OwnerOfOutfit(address user, uint256 outfitId);
error Marketplace__NotOwnerOfOutfit(address user, uint256 outfitId);

error Marketplace__OutfitDoesNotExist(uint256 outfitId);

error Marketplace__AlreadyOnAuction(uint256 outfitId);
error Marketplace__AlreadyOnStore(uint256 outfitId);
error Marketplace__NotOnStore(uint256 outfitId);

error Marketplace__NotValidAmount(uint256 amount);
error Marketplace__NotEnoughUsableBalance(address user, uint256 requirement);

contract Marketplace {
    // ================================ Events ================================
    event OutfitOnSell(
        address user,
        address outfitContract,
        uint256 outfitId,
        uint256 price
    );

    event OutfitBought(address buyer, address seller, uint256 outfitId);

    event OutfitStoreEntryRemoved(uint256 outfitId, address seller);

    // ============================ Struct & Enums ============================
    struct SaleItem {
        address seller;
        uint256 price;
    }

    // ============================ State Variables ===========================
    Outfit private _outfit;
    Auction private _auction;
    Users private _users;

    address private _owner;
    mapping(uint256 => SaleItem) private _store;

    // ============================== Modifiers ===============================
    modifier isOwner() {
        if (msg.sender != _owner) revert Marketplace__NotOwner(msg.sender);
        _;
    }
    modifier outfitExists(uint256 outfitId) {
        if (!_outfit.exists(outfitId))
            revert Marketplace__OutfitDoesNotExist(outfitId);
        _;
    }

    modifier isOwnerOfOutfit(uint256 outfitId, bool _is) {
        address user = msg.sender;

        if (_is && user != _outfit.ownerOf(outfitId))
            revert Marketplace__NotOwnerOfOutfit(msg.sender, outfitId);
        else if (!_is && user == _outfit.ownerOf(outfitId))
            revert Marketplace__OwnerOfOutfit(msg.sender, outfitId);
        _;
    }

    modifier notOnAuction(uint256 outfitId) {
        bool onAuction = _auction.isOutfitOnAuction(outfitId);
        if (onAuction) revert Marketplace__AlreadyOnAuction(outfitId);
        _;
    }

    modifier isValidAmount(uint256 amount) {
        if (amount <= 0) revert Marketplace__NotValidAmount(amount);
        _;
    }

    modifier onStore(uint256 outfitId, bool _is) {
        if (_is && _store[outfitId].seller == address(0))
            revert Marketplace__NotOnStore(outfitId);
        else if (!_is && _store[outfitId].seller != address(0))
            revert Marketplace__AlreadyOnStore(outfitId);
        _;
    }

    modifier hasEnoughUsableBalance(uint256 requirement) {
        if (_users.getUsableBalance(msg.sender) < requirement)
            revert Marketplace__NotEnoughUsableBalance(msg.sender, requirement);
        _;
    }

    // ================================ Admin =================================
    constructor() {
        _owner = msg.sender;
    }

    function setOutfitContract(address newAddress) external isOwner {
        _outfit = Outfit(newAddress);
    }

    function setAuctionContract(address newAddress) external isOwner {
        _auction = Auction(newAddress);
    }

    function setUsersContract(address newAddress) external isOwner {
        _users = Users(newAddress);
    }

    // =============================== Getters ================================
    function isOutfitOnSell(uint256 outfitId) public view returns (bool) {
        if (_store[outfitId].seller != address(0)) return true;
        return false;
    }

    function getOutfitEntry(
        uint256 outfitId
    ) public view returns (SaleItem memory entry) {
        return _store[outfitId];
    }

    // ============================== Functions ===============================
    function putOnSell(
        uint256 outfitId,
        uint256 price
    )
        external
        outfitExists(outfitId)
        isOwnerOfOutfit(outfitId, true)
        onStore(outfitId, false)
        notOnAuction(outfitId)
        isValidAmount(price)
    {
        _store[outfitId] = SaleItem(msg.sender, price);

        emit OutfitOnSell(msg.sender, address(_outfit), outfitId, price);
    }

    function buyOutfit(
        uint256 outfitId
    )
        external
        outfitExists(outfitId)
        onStore(outfitId, true)
        isOwnerOfOutfit(outfitId, false)
        hasEnoughUsableBalance(_store[outfitId].price)
    {
        address seller = _store[outfitId].seller;
        address buyer = msg.sender;

        // transfer ownership of outfit
        _outfit.safeTransferFrom(seller, buyer, outfitId);

        // updating buyer profile
        _users._addOutfit(buyer, outfitId);
        _users._removeBalance(buyer, _store[outfitId].price);

        // updating seller profile
        _users._removeOutfit(seller, outfitId);
        _users._addBalance(seller, _store[outfitId].price);

        // removing entry from store
        delete _store[outfitId];

        emit OutfitBought(buyer, seller, outfitId);
    }

    function removeFromSell(
        uint256 outfitId
    )
        external
        outfitExists(outfitId)
        isOwnerOfOutfit(outfitId, true)
        onStore(outfitId, true)
    {
        // deleting the entry from store
        delete _store[outfitId];

        emit OutfitStoreEntryRemoved(outfitId, msg.sender);
    }
}
