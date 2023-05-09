const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe("Tests for Users.sol,", () => {
      let Users, Outfit, Marketplace, Auction;
      let accounts, deployer, user1, user2;
      const DEFAULT_TOKEN_URI = "TokenURI:";
      const TOKEN_URI = (id) => DEFAULT_TOKEN_URI + id;

      // setting up accounts and deploying the contract
      beforeEach(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        bidders = [];
        for (let index of [3, 4, 5]) bidders.push(accounts[index]);

        // deploying App Contract
        const UsersContract = await ethers.getContractFactory("Users");
        Users = await UsersContract.connect(deployer).deploy();

        // deploying Outfit Contract
        const OutfitContract = await ethers.getContractFactory("Outfit");
        Outfit = await OutfitContract.connect(deployer).deploy();

        // deploying Marketplace Contract
        const MarketplaceContract = await ethers.getContractFactory(
          "Marketplace"
        );
        Marketplace = await MarketplaceContract.connect(deployer).deploy();

        // deploying Auction Contract
        const AuctionContract = await ethers.getContractFactory("Auction");
        Auction = await AuctionContract.connect(deployer).deploy();

        // Setting up Users Contract
        for (let address of [
          Marketplace.address,
          Outfit.address,
          Auction.address,
        ]) {
          txResponse = await Users.connect(deployer).addAllowedAddress(address);
          await txResponse.wait(1);
        }

        // Setting up Outfit Contract
        txResponse = await Outfit.connect(deployer).setUsersContract(
          Users.address
        );
        await txResponse.wait(1);

        txResponse = await Outfit.connect(deployer).setBaseTokenURI(
          DEFAULT_TOKEN_URI
        );
        await txResponse.wait(1);

        // Setting up Marketplace Contract
        txResponse = await Marketplace.connect(deployer).setOutfitContract(
          Outfit.address
        );
        await txResponse.wait(1);

        txResponse = await Marketplace.connect(deployer).setUsersContract(
          Users.address
        );
        await txResponse.wait(1);

        txResponse = await Marketplace.connect(deployer).setAuctionContract(
          Auction.address
        );
        await txResponse.wait(1);

        // Setting up Auction Contract
        txResponse = await Auction.connect(deployer).setOutfitContract(
          Outfit.address
        );
        await txResponse.wait(1);

        txResponse = await Auction.connect(deployer).setUsersContract(
          Users.address
        );
        await txResponse.wait(1);

        txResponse = await Auction.connect(deployer).setMarketplaceContract(
          Marketplace.address
        );
        await txResponse.wait(1);
      });

      describe("getBalance", () => {
        it("should return correct balance: 1", async () => {
          const balance = await Users.connect(user1).getBalance();

          assert.equal(balance, 0);
        });

        it("should return correct balance: 2", async () => {
          const oldBalance = await Users.getBalance();

          const addedBalance = ethers.utils.parseEther("0.1");
          const txResponse = await Users.addBalance({ value: addedBalance });
          await txResponse.wait(1);

          const newBalance = await Users.getBalance();

          assert.equal(
            newBalance.sub(oldBalance).toString(),
            addedBalance.toString()
          );
        });
      });

      describe("getMyOutfits", () => {
        it("should return correct outfits: 1", async () => {
          const myOutfits = await Users.connect(user1).getMyOutfits();

          assert.equal(myOutfits.length, 0);
        });

        it("should return correct outfits: 2", async () => {
          const outfitId = await Outfit.getNextOutfitId();
          const txResponse = await Outfit.connect(user1).mintOutfit();
          await txResponse.wait(1);

          const myOutfits = await Users.connect(user1).getMyOutfits();

          assert.equal(myOutfits.length, 1);
          assert.equal(myOutfits[0].toString(), outfitId.toString());
        });
      });

      describe("Restricted Functionalities", () => {
        it("should not let any user add Allowed Address", async () => {
          await expect(Users.connect(user1).addAllowedAddress(user1.address))
            .to.be.revertedWithCustomError(Users, "Users__NotOwner")
            .withArgs(user1.address);
        });

        it("should not let any user add outfit on their own", async () => {
          await expect(Users.connect(user1)._addOutfit(user1.address, 0))
            .to.be.revertedWithCustomError(Users, "Users__NotAllowed")
            .withArgs(user1.address);
        });

        it("should not let any user remove outfit on their own", async () => {
          await expect(Users.connect(user1)._removeOutfit(user1.address, 0))
            .to.be.revertedWithCustomError(Users, "Users__NotAllowed")
            .withArgs(user1.address);
        });

        it("should not let any user add balance on their own", async () => {
          await expect(Users.connect(user1)._addBalance(user1.address, 0))
            .to.be.revertedWithCustomError(Users, "Users__NotAllowed")
            .withArgs(user1.address);
        });

        it("should not let any user remove balance on their own", async () => {
          await expect(Users.connect(user1)._removeBalance(user1.address, 0))
            .to.be.revertedWithCustomError(Users, "Users__NotAllowed")
            .withArgs(user1.address);
        });

        it("should not let any user add outstanding balance", async () => {
          await expect(
            Users.connect(user1)._addOutstandingBalance(user1.address, 0)
          )
            .to.be.revertedWithCustomError(Users, "Users__NotAllowed")
            .withArgs(user1.address);
        });

        it("should not let any user remove outstanding balance", async () => {
          await expect(
            Users.connect(user1)._removeOutstandingBalance(user1.address, 0)
          )
            .to.be.revertedWithCustomError(Users, "Users__NotAllowed")
            .withArgs(user1.address);
        });
      });

      describe("removeOutfit", () => {
        let outfitIds = [];
        // minting one outfit before each test
        beforeEach(async () => {
          outfitIds = [];

          for (let _ in [1, 2, 3]) {
            const outfitId = await Outfit.getNextOutfitId();
            const txResponse = await Outfit.connect(user1).mintOutfit();
            await txResponse.wait(1);

            outfitIds.push(outfitId);
          }
        });

        it("should check if outfit exists", async () => {
          const nonExistantId = await Outfit.getNextOutfitId();
          await expect(Users.removeOutfit(nonExistantId))
            .to.be.revertedWithCustomError(Users, "Users__OutfitDoesNotExist")
            .withArgs(nonExistantId);
        });

        it("should delete the first entry from user's profile", async () => {
          const txResponse = await Users.connect(user1).removeOutfit(
            outfitIds[0]
          );
          await txResponse.wait(1);

          outfitIds.shift();
          const userOutfits = await Users.connect(user1).getMyOutfits();

          for (let index in outfitIds) {
            assert.equal(
              outfitIds[index].toString(),
              userOutfits[index].toString()
            );
          }
        });

        it("should delete the middle entry from user's profile", async () => {
          const txResponse = await Users.connect(user1).removeOutfit(
            outfitIds[1]
          );
          await txResponse.wait(1);

          outfitIds.splice(1, 1);
          const userOutfits = await Users.connect(user1).getMyOutfits();

          for (let index in outfitIds) {
            assert.equal(
              outfitIds[index].toString(),
              userOutfits[index].toString()
            );
          }
        });

        it("should delete the last entry from user's profile", async () => {
          const txResponse = await Users.connect(user1).removeOutfit(
            outfitIds[2]
          );
          await txResponse.wait(1);

          outfitIds.pop();
          const userOutfits = await Users.connect(user1).getMyOutfits();

          for (let index in outfitIds) {
            assert.equal(
              outfitIds[index].toString(),
              userOutfits[index].toString()
            );
          }
        });
      });

      describe("Balance Functionality", () => {
        it("should let user add balance", async () => {
          const oldBalance = await Users.connect(user1).getBalance();

          const amount = ethers.utils.parseEther("0.5");

          const txResponse = await Users.connect(user1).addBalance({
            value: amount,
          });
          await txResponse.wait(1);

          const newBalance = await Users.connect(user1).getBalance();

          assert.equal(
            newBalance.sub(oldBalance).toString(),
            amount.toString()
          );
        });

        it("should let user withdraw balance", async () => {
          const amount = ethers.utils.parseEther("0.5");

          const txResponse1 = await Users.connect(user1).addBalance({
            value: amount,
          });
          await txResponse1.wait(1);

          const oldBalance = await Users.connect(user1).getBalance();

          const txResponse2 = await Users.connect(user1).withdrawBalance(
            amount
          );
          await txResponse2.wait(1);

          const newBalance = await Users.connect(user1).getBalance();

          assert.equal(
            oldBalance.sub(newBalance).toString(),
            amount.toString()
          );
        });
      });
    })
  : describe.skip;
