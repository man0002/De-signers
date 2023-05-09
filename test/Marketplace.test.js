const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe("Tests for Marketplace.sol,", () => {
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

      describe("Restricted Functionalities", () => {
        it("should not allow any user to set Outfit Contract", async () => {
          await expect(
            Marketplace.connect(user1).setOutfitContract(user1.address)
          )
            .to.be.revertedWithCustomError(Marketplace, "Marketplace__NotOwner")
            .withArgs(user1.address);
        });

        it("should not allow any user to set Auction Contract", async () => {
          await expect(
            Marketplace.connect(user1).setAuctionContract(user1.address)
          )
            .to.be.revertedWithCustomError(Marketplace, "Marketplace__NotOwner")
            .withArgs(user1.address);
        });

        it("should not allow any user to set Users Contract", async () => {
          await expect(
            Marketplace.connect(user1).setUsersContract(user1.address)
          )
            .to.be.revertedWithCustomError(Marketplace, "Marketplace__NotOwner")
            .withArgs(user1.address);
        });
      });

      describe("putOnSell", () => {
        let outfitId;
        let outfitPrice = ethers.utils.parseEther("0.1");

        beforeEach(async () => {
          // mints one outfit
          outfitId = await Outfit.getNextOutfitId();
          const txResponse1 = await Outfit.connect(user1).mintOutfit();
          await txResponse1.wait(1);

          // get approval for Marketplace to handle transactions
          const txResponse2 = await Outfit.connect(user1).approve(
            Marketplace.address,
            outfitId
          );
          await txResponse2.wait(1);
        });

        it("should put outfit on store", async () => {
          const txResponse = await Marketplace.connect(user1).putOnSell(
            outfitId,
            outfitPrice
          );
          await txResponse.wait(1);

          assert.equal(
            await Marketplace.connect(user1).isOutfitOnSell(outfitId),
            true
          );
          assert.equal(
            (await Marketplace.connect(user1).getOutfitEntry(outfitId)).seller,
            user1.address
          );
          assert.equal(
            (
              await Marketplace.connect(user1).getOutfitEntry(outfitId)
            ).price.toString(),
            outfitPrice.toString()
          );
        });

        it("should emit event", async () => {
          await expect(
            Marketplace.connect(user1).putOnSell(outfitId, outfitPrice)
          )
            .to.emit(Marketplace, "OutfitOnSell")
            .withArgs(user1.address, Outfit.address, outfitId, outfitPrice);
        });

        it("should check if outfit exist", async () => {
          const nonExistantId = await Outfit.connect(user1).getNextOutfitId();

          await expect(
            Marketplace.connect(user1).putOnSell(nonExistantId, outfitPrice)
          )
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__OutfitDoesNotExist"
            )
            .withArgs(nonExistantId);
        });

        it("should only let the owner of outfit to put on sell", async () => {
          await expect(
            Marketplace.connect(user2).putOnSell(outfitId, outfitPrice)
          )
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__NotOwnerOfOutfit"
            )
            .withArgs(user2.address, outfitId);
        });

        it("should only allow items that are not already on auction", async () => {
          let outfitEndtimestamp = Math.round(Date.now() / 1000) + 10000;
          const txResponse = await Auction.connect(user1).putOnAuction(
            outfitId,
            outfitPrice,
            outfitEndtimestamp
          );
          await txResponse.wait(1);

          await expect(
            Marketplace.connect(user1).putOnSell(outfitId, outfitPrice)
          )
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__AlreadyOnAuction"
            )
            .withArgs(outfitId);
        });

        it("should only allow items that are not already on store", async () => {
          const txResponse = await Marketplace.connect(user1).putOnSell(
            outfitId,
            outfitPrice
          );
          await txResponse.wait(1);

          await expect(
            Marketplace.connect(user1).putOnSell(outfitId, outfitPrice)
          )
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__AlreadyOnStore"
            )
            .withArgs(outfitId);
        });

        it("should check if amount is valid", async () => {
          const notValidPrice = ethers.utils.parseEther("0");
          await expect(
            Marketplace.connect(user1).putOnSell(outfitId, notValidPrice)
          )
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__NotValidAmount"
            )
            .withArgs(notValidPrice);
        });
      });

      describe("buyOutfit", () => {
        let outfitId;
        let outfitPrice = ethers.utils.parseEther("0.1");

        beforeEach(async () => {
          // mints multiple outfit
          for (let _ in [1, 2, 3]) {
            const txResponse1 = await Outfit.connect(user1).mintOutfit();
            await txResponse1.wait(1);
          }
          outfitId = (await Users.connect(user1).getMyOutfits())[1];

          // get approval for Marketplace to handle transactions
          const txResponse2 = await Outfit.connect(user1).approve(
            Marketplace.address,
            outfitId
          );
          await txResponse2.wait(1);

          // puts the item on sell
          const txResponse3 = await Marketplace.connect(user1).putOnSell(
            outfitId,
            outfitPrice
          );
          await txResponse3.wait(1);
        });

        it("should check if outfit exists", async () => {
          const nonExistantId = await Outfit.connect(user2).getNextOutfitId();

          await expect(Marketplace.connect(user2).buyOutfit(nonExistantId))
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__OutfitDoesNotExist"
            )
            .withArgs(nonExistantId);
        });

        it("should not let seller buy outfit", async () => {
          await expect(Marketplace.connect(user1).buyOutfit(outfitId))
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__OwnerOfOutfit"
            )
            .withArgs(user1.address, outfitId);
        });

        it("only allows item that are on marketplace to be bought", async () => {
          const txResponse1 = await Users.connect(user2).addBalance({
            value: outfitPrice,
          });
          await txResponse1.wait(1);

          const txResponse2 = await Marketplace.connect(user2).buyOutfit(
            outfitId
          );
          await txResponse2.wait(1);

          await expect(Marketplace.connect(user2).buyOutfit(outfitId))
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__NotOnStore"
            )
            .withArgs(outfitId);
        });

        it("should not let buy user with insufficient balance", async () => {
          await expect(Marketplace.connect(user2).buyOutfit(outfitId))
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__NotEnoughUsableBalance"
            )
            .withArgs(user2.address, outfitPrice);
        });

        it("should transfer ownership of outfit", async () => {
          const txResponse1 = await Users.connect(user2).addBalance({
            value: outfitPrice,
          });
          await txResponse1.wait(1);

          const txResponse2 = await Marketplace.connect(user2).buyOutfit(
            outfitId
          );
          await txResponse2.wait(1);

          assert.equal(await Outfit.ownerOf(outfitId), user2.address);
        });

        it("should add outfit to buyer's profile", async () => {
          const txResponse1 = await Users.connect(user2).addBalance({
            value: outfitPrice,
          });
          await txResponse1.wait(1);

          const txResponse2 = await Marketplace.connect(user2).buyOutfit(
            outfitId
          );
          await txResponse2.wait(1);

          const myOutfits = await Users.connect(user2).getMyOutfits();

          assert.equal(myOutfits.length, 1);
          assert.equal(myOutfits[0].toString(), outfitId.toString());
        });

        it("should deduct balance from buyer's profile", async () => {
          const txResponse1 = await Users.connect(user2).addBalance({
            value: outfitPrice,
          });
          await txResponse1.wait(1);

          const oldBalance = await Users.connect(user2).getBalance();

          const txResponse2 = await Marketplace.connect(user2).buyOutfit(
            outfitId
          );
          await txResponse2.wait(1);

          const newBalance = await Users.connect(user2).getBalance();
          assert.equal(
            newBalance.toString(),
            oldBalance.sub(outfitPrice).toString()
          );
        });

        it("should remove outfit from seller's profile", async () => {
          const txResponse1 = await Users.connect(user2).addBalance({
            value: outfitPrice,
          });
          await txResponse1.wait(1);

          const txResponse2 = await Marketplace.connect(user2).buyOutfit(
            outfitId
          );
          await txResponse2.wait(1);

          const myOutfits = await Users.connect(user1).getMyOutfits();

          assert.equal(myOutfits.length, 2);
        });

        it("should add balance to seller's profile", async () => {
          const oldBalanceUser1 = await Users.connect(user1).getBalance();

          const txResponse1 = await Users.connect(user2).addBalance({
            value: outfitPrice,
          });
          await txResponse1.wait(1);

          const txResponse2 = await Marketplace.connect(user2).buyOutfit(
            outfitId
          );
          await txResponse2.wait(1);

          const newBalanceUser1 = await Users.connect(user1).getBalance();
          assert.equal(
            newBalanceUser1.toString(),
            oldBalanceUser1.add(outfitPrice).toString()
          );
        });

        it("should delete entry from store", async () => {
          const txResponse1 = await Users.connect(user2).addBalance({
            value: outfitPrice,
          });
          await txResponse1.wait(1);

          const txResponse2 = await Marketplace.connect(user2).buyOutfit(
            outfitId
          );
          await txResponse2.wait(1);

          assert.equal(await Marketplace.isOutfitOnSell(outfitId), false);
        });
      });

      describe("removeFromSell", () => {
        let outfitId;
        let outfitPrice = ethers.utils.parseEther("0.1");

        beforeEach(async () => {
          // mints one outfit
          outfitId = await Outfit.getNextOutfitId();
          const txResponse1 = await Outfit.connect(user1).mintOutfit();
          await txResponse1.wait(1);

          // get approval for Marketplace to handle transactions
          const txResponse2 = await Outfit.connect(user1).approve(
            Marketplace.address,
            outfitId
          );
          await txResponse2.wait(1);

          // puts the item on sell
          const txResponse3 = await Marketplace.connect(user1).putOnSell(
            outfitId,
            outfitPrice
          );
          await txResponse3.wait(1);
        });

        it("should check if outfit exists", async () => {
          const nonExistantId = await Outfit.getNextOutfitId();

          await expect(Marketplace.connect(user2).removeFromSell(nonExistantId))
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__OutfitDoesNotExist"
            )
            .withArgs(nonExistantId);
        });

        it("should only allow owner of outfit to remove from sell", async () => {
          await expect(Marketplace.connect(user2).removeFromSell(outfitId))
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__NotOwnerOfOutfit"
            )
            .withArgs(user2.address, outfitId);
        });

        it("should check if item exists on the marketplace", async () => {
          const txResponse1 = await Users.connect(user2).addBalance({
            value: outfitPrice,
          });
          await txResponse1.wait(1);

          const txResponse2 = await Marketplace.connect(user2).buyOutfit(
            outfitId
          );
          await txResponse2.wait(1);

          await expect(Marketplace.connect(user2).removeFromSell(outfitId))
            .to.be.revertedWithCustomError(
              Marketplace,
              "Marketplace__NotOnStore"
            )
            .withArgs(outfitId);
        });

        it("should delete entry from marketplace", async () => {
          const txResponse = await Marketplace.connect(user1).removeFromSell(
            outfitId
          );
          await txResponse.wait(1);

          assert.equal(await Marketplace.isOutfitOnSell(outfitId), false);
        });
      });
    })
  : describe.skip;
