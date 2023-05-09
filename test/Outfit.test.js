const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { utils } = require("ethers");

developmentChains.includes(network.name)
  ? describe("Tests for Outfit.sol,", () => {
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

      describe("Admin Functionalities", async () => {
        it("should not let any user set Users Contract", async () => {
          await expect(Outfit.connect(user1).setUsersContract(Outfit.address))
            .to.be.revertedWithCustomError(Outfit, "Outfit__NotAuthorized")
            .withArgs(user1.address);
        });

        it("should not let any user set Base Token URI", async () => {
          await expect(Outfit.connect(user1).setBaseTokenURI("Fake"))
            .to.be.revertedWithCustomError(Outfit, "Outfit__NotAuthorized")
            .withArgs(user1.address);
        });
      });

      describe("mintOutfit", () => {
        it("should mint one outfit", async () => {
          const outfitId = await Outfit.getNextOutfitId();
          const txResponse = await Outfit.connect(user1).mintOutfit();
          await txResponse.wait(1);

          assert.equal(await Outfit.exists(outfitId), true);
        });

        it("should increment outfit ID", async () => {
          const previousId = await Outfit.getNextOutfitId();
          const txResponse = await Outfit.connect(user1).mintOutfit();
          await txResponse.wait(1);
          const newId = await Outfit.getNextOutfitId();

          assert.notEqual(previousId.toString(), newId.toString());
        });

        it("should mint multiple outfits", async () => {
          for (let _ in [1, 2, 3]) {
            const outfitId = await Outfit.getNextOutfitId();
            const txResponse = await Outfit.connect(user1).mintOutfit();
            await txResponse.wait(1);

            assert.equal(await Outfit.exists(outfitId), true);
          }
        });

        it("should give user the ownership of minted outfit", async () => {
          const outfitId = await Outfit.getNextOutfitId();
          const txResponse = await Outfit.connect(user1).mintOutfit();
          await txResponse.wait(1);

          assert.equal(await Outfit.connect(user1).isMyOutfit(outfitId), true);
        });

        it("should add entry to caller's profile", async () => {
          const previousOutfits = await Users.connect(user1).getMyOutfits();

          const outfitId = await Outfit.getNextOutfitId();
          const txResponse = await Outfit.connect(user1).mintOutfit();
          await txResponse.wait(1);

          const newOutfits = await Users.connect(user1).getMyOutfits();

          assert.notEqual(previousOutfits.length, newOutfits.length);
          assert.equal(newOutfits[0].toString(), outfitId.toString());
        });
      });

      describe("deleteOutfit", () => {
        let outfitId;
        beforeEach(async () => {
          outfitId = await Outfit.getNextOutfitId();
          const txResponse = await Outfit.connect(user1).mintOutfit();
          await txResponse.wait(1);
        });

        it("should delete outfit", async () => {
          const txResponse = await Outfit.connect(user1).deleteOutfit(outfitId);
          await txResponse.wait(1);

          assert.equal(await Outfit.exists(outfitId), false);
        });

        it("should delete entry from user's profile", async () => {
          const txResponse = await Outfit.connect(user1).deleteOutfit(outfitId);
          await txResponse.wait(1);

          const myOutfits = await Users.connect(user1).getMyOutfits();

          assert.equal(myOutfits.length, 0);
        });

        it("should only let owner of the outfit to delete", async () => {
          await expect(Outfit.connect(user2).deleteOutfit(outfitId))
            .to.be.revertedWithCustomError(Outfit, "Outfit__NotOwnerOfOutfit")
            .withArgs(outfitId, user2.address);
        });
      });
    })
  : describe.skip;
