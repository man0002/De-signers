// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "hardhat/console.sol";
error Users__NotAllowed(address sender);
error Users__NotOwner(address sender);
error Users__OutfitDoesNotExist(uint256 outfitId);

contract Users {
    // =========================== State Variables ============================
    struct UserItem {
        string name;
        uint256[] outfits;
        uint256 balance;
        uint256 outstandingBalance;
    }

    address private _owner;

    mapping(address => bool) private _allowed;
    mapping(address => UserItem) public users;

    // ============================== Modifiers ===============================
    modifier isOwner() {
        if (msg.sender != _owner) revert Users__NotOwner(msg.sender);
        _;
    }

    modifier onlyAllowed() {
        if (!_allowed[msg.sender]) revert Users__NotAllowed(msg.sender);
        _;
    }

    modifier outfitExist(address user, uint256 outfitId) {
        uint256[] storage outfits = users[user].outfits;
        bool isOk = false;
        for (uint256 i = 0; i < outfits.length; i++)
            if (outfits[i] == outfitId) isOk = true;

        if (!isOk) revert Users__OutfitDoesNotExist(outfitId);
        _;
    }

    // ================================ Admin =================================
    constructor() {
        _owner = msg.sender;
    }

    function addAllowedAddress(address newAddress) public isOwner {
        _allowed[newAddress] = true;
    }

    // =============================== Getters ================================
    function getBalance() public view returns (uint256) {
        return users[msg.sender].balance;
    }

    function getOutstandingBalance() public view returns (uint256) {
        return users[msg.sender].outstandingBalance;
    }

    function getMyOutfits() public view returns (uint256[] memory) {
        return users[msg.sender].outfits;
    }

    function getUsableBalance(address user) public view returns (uint256) {
        return users[user].balance - users[user].outstandingBalance;
    }

    // ============================= Marketplace ==============================
    function _addOutfit(address user, uint256 outfitId) public onlyAllowed {
        users[user].outfits.push(outfitId);
    }

    function _removeOutfit(address user, uint256 outfitId) public onlyAllowed {
        // finding index of entry in user's profile
        uint256 index = 0;
        uint256 totalOutfits = users[user].outfits.length;
        for (uint256 i = 0; i < totalOutfits; i++) {
            if (users[user].outfits[i] == outfitId) {
                index = i;
                break;
            }
        }

        // removing the entry from the profile
        for (uint256 i = index + 1; i < totalOutfits; i++) {
            users[user].outfits[i - 1] = users[user].outfits[i];
        }

        users[user].outfits.pop();
    }

    function _addBalance(address user, uint256 balance) public onlyAllowed {
        users[user].balance += balance;
    }

    function _removeBalance(address user, uint256 balance) public onlyAllowed {
        users[user].balance -= balance;
    }

    function _addOutstandingBalance(
        address user,
        uint256 balance
    ) public onlyAllowed {
        users[user].outstandingBalance += balance;
    }

    function _removeOutstandingBalance(
        address user,
        uint256 balance
    ) public onlyAllowed {
        users[user].outstandingBalance -= balance;
    }

    // =============================== Functions ==============================
    function removeOutfit(
        uint256 outfitId
    ) public outfitExist(msg.sender, outfitId) {
        // finding index of entry in user's profile
        address user = msg.sender;
        uint256 index = 0;
        uint256 totalOutfits = users[user].outfits.length;
        for (uint256 i = 0; i < totalOutfits; i++) {
            if (users[user].outfits[i] == outfitId) {
                index = i;
                break;
            }
        }
        // removing the entry from the profile
        for (uint256 i = index + 1; i < totalOutfits; i++) {
            users[user].outfits[i - 1] = users[user].outfits[i];
        }
        users[user].outfits.pop();
    }

    function addBalance() public payable {
        users[msg.sender].balance += msg.value;
    }

    function withdrawBalance(uint256 amount) public payable {
        users[msg.sender].balance -= amount;
        payable(msg.sender).transfer(amount);
    }
}
