// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./Users.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

error Outfit__NotAuthorized(address user);
error Outfit__NotOwnerOfOutfit(uint256 outfitId, address user);

contract Outfit is ERC721 {
    // ============================ State Variables ===========================
    using Counters for Counters.Counter;

    Users private _users;
    Counters.Counter private currentOutfitID;
    string public baseOutfitURI;
    address private owner;

    // =============================== Modiifers ==============================
    modifier isOwner(address sender) {
        if (sender != owner) revert Outfit__NotAuthorized(sender);
        _;
    }

    modifier isOwnerOfOutfit(uint256 outfitId) {
        if (msg.sender != _ownerOf(outfitId))
            revert Outfit__NotOwnerOfOutfit(outfitId, msg.sender);
        _;
    }

    // ================================ Admin =================================
    constructor() ERC721("Outfit NFT", "NFT") {
        baseOutfitURI = "";
        owner = msg.sender;
    }

    function setUsersContract(address newAddress) public isOwner(msg.sender) {
        _users = Users(newAddress);
    }

    function setBaseTokenURI(
        string memory _baseOutfitURI
    ) public isOwner(msg.sender) {
        baseOutfitURI = _baseOutfitURI;
    }

    // =============================== Getters ================================
    function getNextOutfitId() public view returns (uint256) {
        return currentOutfitID.current();
    }

    function exists(uint256 outfitId) public view returns (bool) {
        return _exists(outfitId);
    }

    function isMyOutfit(uint256 outfitId) public view returns (bool) {
        return _ownerOf(outfitId) == msg.sender;
    }

    // =============================== Functions ==============================

    function mintOutfit() public returns (uint256) {
        uint256 newItemId = currentOutfitID.current();

        // minting token
        _safeMint(msg.sender, newItemId);

        // adding it to user's profile
        _users._addOutfit(msg.sender, newItemId);

        // increment outfitId
        currentOutfitID.increment();

        return newItemId;
    }

    function deleteOutfit(uint256 outfitId) public isOwnerOfOutfit(outfitId) {
        _users._removeOutfit(msg.sender, outfitId);
        _burn(outfitId);
    }
}

// Referred From: https://docs.opensea.io/v1.0/docs/creating-an-nft-contract
