const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const {
  time,
  takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");

developmentChains.includes(network.name)
  ? describe("Tests for Auction.sol,", () => {
      let Users, Outfit, Marketplace, Auction;
      let accounts, deployer, user1, user2;
      let bidders = [];
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
          await expect(Auction.connect(user1).setOutfitContract(user1.address))
            .to.be.revertedWithCustomError(
              Auction,
              "Auction__NotOwnerOfContract"
            )
            .withArgs(user1.address);
        });

        it("should not allow any user to set Users Contract", async () => {
          await expect(Auction.connect(user1).setUsersContract(user1.address))
            .to.be.revertedWithCustomError(
              Auction,
              "Auction__NotOwnerOfContract"
            )
            .withArgs(user1.address);
        });

        it("should not allow any user to set Marketplace Contract", async () => {
          await expect(
            Auction.connect(user1).setMarketplaceContract(user1.address)
          )
            .to.be.revertedWithCustomError(
              Auction,
              "Auction__NotOwnerOfContract"
            )
            .withArgs(user1.address);
        });
      });

      describe("putOnAuction", () => {
        let outfitId;
        let outfitBasePrice = ethers.utils.parseEther("0.1");
        let outfitEndtimestamp = Math.round(Date.now() / 1000) + 10000;

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

        it("should put outfit on auction", async () => {
          const txResponse = await Auction.connect(user1).putOnAuction(
            outfitId,
            outfitBasePrice,
            outfitEndtimestamp
          );
          await txResponse.wait(1);

          assert.equal(
            await Auction.connect(user1).isOutfitOnAuction(outfitId),
            true
          );
          assert.equal(
            (await Auction.connect(user1).getOutfitEntry(outfitId)).seller,
            user1.address
          );
          assert.equal(
            (
              await Auction.connect(user1).getOutfitEntry(outfitId)
            ).basePrice.toString(),
            outfitBasePrice.toString()
          );
          assert.equal(
            (await Auction.connect(user1).getOutfitEntry(outfitId))
              .endTimestamp,
            outfitEndtimestamp
          );
        });

        it("should change max bid", async () => {
          const txResponse = await Auction.connect(user1).putOnAuction(
            outfitId,
            outfitBasePrice,
            outfitEndtimestamp
          );
          await txResponse.wait(1);

          assert.equal(
            (await Auction._getMaxBid(outfitId)).toString(),
            outfitBasePrice.toString()
          );
        });

        it("should not change max bidder", async () => {
          const txResponse = await Auction.connect(user1).putOnAuction(
            outfitId,
            outfitBasePrice,
            outfitEndtimestamp
          );
          await txResponse.wait(1);

          assert.equal(
            await Auction._getMaxBidder(outfitId),
            ethers.constants.AddressZero
          );
        });

        it("should emit event", async () => {
          await expect(
            Auction.connect(user1).putOnAuction(
              outfitId,
              outfitBasePrice,
              outfitEndtimestamp
            )
          )
            .to.emit(Auction, "OutfitOnAuction")
            .withArgs(
              user1.address,
              Outfit.address,
              outfitId,
              outfitBasePrice,
              outfitEndtimestamp
            );
        });

        it("should check if outfit exist", async () => {
          const nonExistantId = await Outfit.connect(user1).getNextOutfitId();

          await expect(
            Auction.connect(user1).putOnAuction(
              nonExistantId,
              outfitBasePrice,
              outfitEndtimestamp
            )
          )
            .to.be.revertedWithCustomError(
              Auction,
              "Auction__OutfitDoesNotExist"
            )
            .withArgs(nonExistantId);
        });

        it("should only allow owner of the outfit to put on auction", async () => {
          await expect(
            Auction.connect(user2).putOnAuction(
              outfitId,
              outfitBasePrice,
              outfitEndtimestamp
            )
          )
            .to.be.revertedWithCustomError(Auction, "Auction__NotOwnerOfOutfit")
            .withArgs(user2.address, outfitId);
        });

        it("should only allow items that are not already on auction", async () => {
          const txResponse = await Auction.connect(user1).putOnAuction(
            outfitId,
            outfitBasePrice,
            outfitEndtimestamp
          );
          await txResponse.wait(1);

          await expect(
            Auction.connect(user1).putOnAuction(
              outfitId,
              outfitBasePrice,
              outfitEndtimestamp
            )
          )
            .to.be.revertedWithCustomError(Auction, "Auction__AlreadyOnAuction")
            .withArgs(outfitId);
        });

        it("should only allow items that are not already on store", async () => {
          const txResponse = await Marketplace.connect(user1).putOnSell(
            outfitId,
            outfitBasePrice
          );
          await txResponse.wait(1);

          await expect(
            Auction.connect(user1).putOnAuction(
              outfitId,
              outfitBasePrice,
              outfitEndtimestamp
            )
          )
            .to.be.revertedWithCustomError(Auction, "Auction__AlreadyOnSell")
            .withArgs(outfitId);
        });

        it("should check if basePrice is valid", async () => {
          const notValidPrice = ethers.utils.parseEther("0");
          await expect(
            Auction.connect(user1).putOnAuction(
              outfitId,
              notValidPrice,
              outfitEndtimestamp
            )
          )
            .to.be.revertedWithCustomError(Auction, "Auction__NotValidPrice")
            .withArgs(notValidPrice);
        });

        it("should check if endTimestamp is not already passed", async () => {
          const nonValidTimestamp = Math.round(Date.now() / 1000) - 10000;

          await expect(
            Auction.connect(user1).putOnAuction(
              outfitId,
              outfitBasePrice,
              nonValidTimestamp
            )
          ).to.be.revertedWithCustomError(
            Auction,
            "Auction__NotValidTimeStamp"
          );
        });
      });

      describe("bidOnAuction", () => {
        let outfitId;
        let outfitBasePrice = ethers.utils.parseEther("0.1");
        let outfitEndtimestamp = Math.round(Date.now() / 1000) + 10000;
        const bidIncrement = ethers.utils.parseEther("0.1");

        beforeEach(async () => {
          // mints one outfit
          outfitId = await Outfit.getNextOutfitId();
          const txResponse1 = await Outfit.connect(user1).mintOutfit();
          await txResponse1.wait(1);

          // get approval for Marketplace to handle transactions
          const txResponse2 = await Outfit.connect(user1).approve(
            Auction.address,
            outfitId
          );
          await txResponse2.wait(1);

          // put on auction
          const txResponse3 = await Auction.connect(user1).putOnAuction(
            outfitId,
            outfitBasePrice,
            outfitEndtimestamp
          );
          await txResponse3.wait(1);
        });

        it("should check if outfit exist", async () => {
          const nonExistantId = await Outfit.getNextOutfitId();

          await expect(
            Auction.connect(bidders[0]).bidOnAuction(
              nonExistantId,
              outfitBasePrice.add(bidIncrement)
            )
          )
            .to.be.revertedWithCustomError(
              Auction,
              "Auction__OutfitDoesNotExist"
            )
            .withArgs(nonExistantId);
        });

        it("should not allow owner to bid", async () => {
          await expect(
            Auction.connect(user1).bidOnAuction(
              outfitId,
              outfitBasePrice.add(bidIncrement)
            )
          )
            .to.be.revertedWithCustomError(Auction, "Auction__OwnerOfOutfit")
            .withArgs(user1.address, outfitId);
        });

        it("should not allow invalid bid", async () => {
          await expect(
            Auction.connect(bidders[0]).bidOnAuction(outfitId, outfitBasePrice)
          )
            .to.be.revertedWithCustomError(Auction, "Auction__NotValidBid")
            .withArgs(outfitId, outfitBasePrice, outfitBasePrice);
        });

        it("should have enough balance to bid", async () => {
          await expect(
            Auction.connect(bidders[0]).bidOnAuction(
              outfitId,
              outfitBasePrice.add(bidIncrement)
            )
          )
            .to.be.revertedWithCustomError(
              Auction,
              "Auction__NotEnoughUsableBalance"
            )
            .withArgs(bidders[0].address, outfitBasePrice.add(bidIncrement));
        });

        it("should add outstanding balance to bidder's profile", async () => {
          const bidAmount = outfitBasePrice.add(bidIncrement);

          const txResponse1 = await Users.connect(bidders[0]).addBalance({
            value: bidAmount,
          });
          await txResponse1.wait(1);

          const txResponse2 = await Auction.connect(bidders[0]).bidOnAuction(
            outfitId,
            bidAmount
          );
          await txResponse2.wait(1);

          assert.equal(
            (
              await Users.connect(bidders[0]).getOutstandingBalance()
            ).toString(),
            bidAmount.toString()
          );
        });

        it("should change usable balance", async () => {
          const bidAmount = outfitBasePrice.add(bidIncrement);

          const txResponse1 = await Users.connect(bidders[0]).addBalance({
            value: ethers.utils.parseEther("1.0"),
          });
          await txResponse1.wait(1);

          const oldBalance = await Users.connect(bidders[0]).getUsableBalance(
            bidders[0].address
          );

          const txResponse2 = await Auction.connect(bidders[0]).bidOnAuction(
            outfitId,
            bidAmount
          );
          await txResponse2.wait(1);

          const newBalance = await Users.connect(bidders[0]).getUsableBalance(
            bidders[0].address
          );

          assert.equal(
            oldBalance.sub(newBalance).toString(),
            bidAmount.toString()
          );
        });

        it("should change max bid", async () => {
          const bidAmount = outfitBasePrice.add(bidIncrement);

          const txResponse1 = await Users.connect(bidders[0]).addBalance({
            value: ethers.utils.parseEther("1.0"),
          });
          await txResponse1.wait(1);

          const txResponse2 = await Auction.connect(bidders[0]).bidOnAuction(
            outfitId,
            bidAmount
          );
          await txResponse2.wait(1);

          assert.equal(
            (await Auction._getMaxBid(outfitId)).toString(),
            bidAmount.toString()
          );
        });

        it("should change max bidder", async () => {
          const bidAmount = outfitBasePrice.add(bidIncrement);

          const txResponse1 = await Users.connect(bidders[0]).addBalance({
            value: ethers.utils.parseEther("1.0"),
          });
          await txResponse1.wait(1);

          const txResponse2 = await Auction.connect(bidders[0]).bidOnAuction(
            outfitId,
            bidAmount
          );
          await txResponse2.wait(1);

          assert.equal(
            await Auction._getMaxBidder(outfitId),
            bidders[0].address
          );
        });

        it("should let user bid multiple times", async () => {
          let bidAmount = outfitBasePrice;

          for (let _ in [1, 2, 3]) {
            bidAmount = bidAmount.add(bidIncrement);

            const txResponse1 = await Users.connect(bidders[0]).addBalance({
              value: bidAmount,
            });
            await txResponse1.wait(1);

            const txResponse2 = await Auction.connect(bidders[0]).bidOnAuction(
              outfitId,
              bidAmount
            );
            await txResponse2.wait(1);

            assert.equal(
              (await Auction._getMaxBid(outfitId)).toString(),
              bidAmount.toString()
            );

            assert.equal(
              await Auction._getMaxBidder(outfitId),
              bidders[0].address
            );
          }
        });

        it("should correctly update bidders array: 1", async () => {
          let bidAmount = outfitBasePrice;

          for (let _ in [1, 2, 3]) {
            bidAmount = bidAmount.add(bidIncrement);

            const txResponse1 = await Users.connect(bidders[0]).addBalance({
              value: bidAmount,
            });
            await txResponse1.wait(1);

            const txResponse2 = await Auction.connect(bidders[0]).bidOnAuction(
              outfitId,
              bidAmount
            );
            await txResponse2.wait(1);

            const auctionItem = await Auction.getOutfitEntry(outfitId);

            assert.equal(auctionItem.bidders.length, 1);
            assert.equal(auctionItem.bidders[0], bidders[0].address);

            assert.equal(auctionItem.bids.length, 1);
            assert.equal(auctionItem.bids[0].toString(), bidAmount.toString());

            assert.equal(
              (await Auction._getMaxBid(outfitId)).toString(),
              bidAmount.toString()
            );
            assert.equal(
              await Auction._getMaxBidder(outfitId),
              bidders[0].address
            );
          }
        });

        it("should correctly update bidders array: 2", async () => {
          let bidAmount = outfitBasePrice;

          // the first bid is seller's
          totalBids = 0;

          for (let index of [0, 1, 2]) {
            bidAmount = bidAmount.add(bidIncrement);

            const txResponse1 = await Users.connect(bidders[index]).addBalance({
              value: bidAmount,
            });
            await txResponse1.wait(1);

            const txResponse2 = await Auction.connect(
              bidders[index]
            ).bidOnAuction(outfitId, bidAmount);
            await txResponse2.wait(1);
            totalBids += 1;

            const auctionItem = await Auction.getOutfitEntry(outfitId);

            assert.equal(auctionItem.bidders.length, totalBids);
            assert.equal(auctionItem.bidders[index], bidders[index].address);

            assert.equal(auctionItem.bids.length, totalBids);
            assert.equal(
              auctionItem.bids[index].toString(),
              bidAmount.toString()
            );

            assert.equal(
              (await Auction._getMaxBid(outfitId)).toString(),
              bidAmount.toString()
            );
            assert.equal(
              await Auction._getMaxBidder(outfitId),
              bidders[index].address
            );
          }
        });

        it("should emit event", async () => {
          const bidAmount = outfitBasePrice.add(bidIncrement);

          const txResponse1 = await Users.connect(bidders[0]).addBalance({
            value: bidAmount,
          });
          await txResponse1.wait(1);

          await expect(
            Auction.connect(bidders[0]).bidOnAuction(outfitId, bidAmount)
          )
            .to.emit(Auction, "AuctionBid")
            .withArgs(outfitId, bidders[0].address, bidAmount);
        });
      });

      describe("endAuction", () => {
        let outfitId;
        let outfitBasePrice = ethers.utils.parseEther("0.1");
        let outfitEndtimestamp = Math.round(Date.now() / 1000) + 10000;

        const bidIncrement = ethers.utils.parseEther("0.1");
        let bids = [];

        beforeEach(async () => {
          let txResponse;

          // mints one outfit
          outfitId = await Outfit.getNextOutfitId();
          txResponse = await Outfit.connect(user1).mintOutfit();
          await txResponse.wait(1);

          // get approval for Marketplace to handle transactions
          txResponse = await Outfit.connect(user1).approve(
            Auction.address,
            outfitId
          );
          await txResponse.wait(1);

          // put on auction
          txResponse = await Auction.connect(user1).putOnAuction(
            outfitId,
            outfitBasePrice,
            outfitEndtimestamp
          );
          await txResponse.wait(1);

          let bidAmount = outfitBasePrice;

          // the first bid is seller's
          totalBids = 0;
          bids = [];
          for (let bidder of bidders) {
            bidAmount = bidAmount.add(bidIncrement);

            txResponse = await Users.connect(bidder).addBalance({
              value: bidAmount,
            });
            await txResponse.wait(1);

            txResponse = await Auction.connect(bidder).bidOnAuction(
              outfitId,
              bidAmount
            );
            await txResponse.wait(1);
            totalBids += 1;

            bids.push(bidAmount);
          }

          bidAmount = bidAmount.add(bidIncrement);
          txResponse = await Users.connect(bidders[1]).addBalance({
            value: bidAmount,
          });
          await txResponse.wait(1);

          txResponse = await Auction.connect(bidders[1]).bidOnAuction(
            outfitId,
            bidAmount
          );
          await txResponse.wait(1);
          bids[1] = bidAmount;
        });

        it("should check if outfit exist", async () => {
          const nonExistantId = await Outfit.getNextOutfitId();

          await expect(Auction.connect(user1).endAuction(nonExistantId))
            .to.be.revertedWithCustomError(
              Auction,
              "Auction__OutfitDoesNotExist"
            )
            .withArgs(nonExistantId);
        });

        it("should check if endtime has passed", async () => {
          await expect(
            Auction.connect(user1).endAuction(outfitId)
          ).to.be.revertedWithCustomError(
            Auction,
            "Auction__EndTimeHasNotPassed"
          );
        });

        it("should transfer ownership to winner", async () => {
          const networkSnapshot = await takeSnapshot();

          const winner = await Auction._getMaxBidder(outfitId);

          time.increaseTo(outfitEndtimestamp);

          const txResponse = await Auction.endAuction(outfitId);
          await txResponse.wait(1);

          assert.equal(await Outfit.connect(user1).isMyOutfit(outfitId), false);
          assert.equal(await Outfit.connect(winner).isMyOutfit(outfitId), true);

          await networkSnapshot.restore();
        });

        it("should add outfit to winner's profile", async () => {
          const networkSnapshot = await takeSnapshot();

          const winner = await Auction._getMaxBidder(outfitId);
          time.increaseTo(outfitEndtimestamp);

          const txResponse = await Auction.endAuction(outfitId);
          await txResponse.wait(1);

          const myOutfits = await Users.connect(winner).getMyOutfits();

          assert.equal(myOutfits.length, 1);
          assert.equal(myOutfits[0].toString(), outfitId.toString());

          await networkSnapshot.restore();
        });

        it("should remove balance from winner's profile", async () => {
          const networkSnapshot = await takeSnapshot();
          const winner = await Auction._getMaxBidder(outfitId);
          const maxBid = await Auction._getMaxBid(outfitId);
          time.increaseTo(outfitEndtimestamp);

          const oldBalance = await Users.connect(winner).getBalance();

          const txResponse = await Auction.endAuction(outfitId);
          await txResponse.wait(1);

          const newBalance = await Users.connect(winner).getBalance();

          assert.equal(
            oldBalance.sub(maxBid).toString(),
            newBalance.toString()
          );

          await networkSnapshot.restore();
        });

        it("should remove outfit from seller's profile", async () => {
          const networkSnapshot = await takeSnapshot();

          time.increaseTo(outfitEndtimestamp);

          const txResponse = await Auction.endAuction(outfitId);
          await txResponse.wait(1);

          const myOutfits = await Users.connect(user1).getMyOutfits();

          assert.equal(myOutfits.length, 0);

          await networkSnapshot.restore();
        });

        it("should add balance to seller's profile", async () => {
          const networkSnapshot = await takeSnapshot();
          const maxBid = await Auction._getMaxBid(outfitId);
          time.increaseTo(outfitEndtimestamp);

          const oldBalance = await Users.connect(user1).getBalance();

          const txResponse = await Auction.endAuction(outfitId);
          await txResponse.wait(1);

          const newBalance = await Users.connect(user1).getBalance();

          assert.equal(
            oldBalance.add(maxBid).toString(),
            newBalance.toString()
          );

          await networkSnapshot.restore();
        });

        it("should reset outstanding balance of all bidders", async () => {
          const networkSnapshot = await takeSnapshot();

          time.increaseTo(outfitEndtimestamp);

          const oldBalances = [];
          for (let bidder of bidders)
            oldBalances.push(
              await Users.connect(bidder).getOutstandingBalance()
            );

          const txResponse = await Auction.endAuction(outfitId);
          await txResponse.wait(1);

          const newBalances = [];
          for (let bidder of bidders)
            newBalances.push(
              await Users.connect(bidder).getOutstandingBalance()
            );

          for (let index in bidders)
            assert.equal(
              oldBalances[index].sub(bids[index]).toString(),
              newBalances[index].toString()
            );
          await networkSnapshot.restore();
        });

        it("should emit event", async () => {
          const networkSnapshot = await takeSnapshot();

          time.increaseTo(outfitEndtimestamp);
          const winner = await Auction._getMaxBidder(outfitId);
          const maxBid = await Auction._getMaxBid(outfitId);

          await expect(Auction.endAuction(outfitId))
            .to.emit(Auction, "AuctionEnded")
            .withArgs(outfitId, winner, maxBid);

          await networkSnapshot.restore();
        });
      });

      describe("removeFromAuction", () => {
        let outfitId;
        let outfitBasePrice = ethers.utils.parseEther("0.1");
        let outfitEndtimestamp = Math.round(Date.now() / 1000) + 10000;

        const bidIncrement = ethers.utils.parseEther("0.1");
        let bids = [];

        beforeEach(async () => {
          // mints one outfit
          outfitId = await Outfit.getNextOutfitId();
          const txResponse1 = await Outfit.connect(user1).mintOutfit();
          await txResponse1.wait(1);

          // get approval for Marketplace to handle transactions
          const txResponse2 = await Outfit.connect(user1).approve(
            Auction.address,
            outfitId
          );
          await txResponse2.wait(1);

          // put on auction
          const txResponse3 = await Auction.connect(user1).putOnAuction(
            outfitId,
            outfitBasePrice,
            outfitEndtimestamp
          );
          await txResponse3.wait(1);

          let bidAmount = outfitBasePrice;

          // the first bid is seller's
          totalBids = 0;
          bids = [];
          for (let bidder of bidders) {
            bidAmount = bidAmount.add(bidIncrement);

            const txResponse1 = await Users.connect(bidder).addBalance({
              value: bidAmount,
            });
            await txResponse1.wait(1);

            const txResponse2 = await Auction.connect(bidder).bidOnAuction(
              outfitId,
              bidAmount
            );
            await txResponse2.wait(1);
            totalBids += 1;

            bids.push(bidAmount);
          }
        });

        it("should check if outfit exists", async () => {
          const nonExistantId = await Outfit.getNextOutfitId();

          await expect(Auction.connect(user1).removeFromAuction(nonExistantId))
            .to.be.revertedWithCustomError(
              Auction,
              "Auction__OutfitDoesNotExist"
            )
            .withArgs(nonExistantId);
        });

        it("should only allow owner of the outfit to delete from auction", async () => {
          await expect(Auction.connect(user2).removeFromAuction(outfitId))
            .to.be.revertedWithCustomError(Auction, "Auction__NotOwnerOfOutfit")
            .withArgs(user2.address, outfitId);
        });

        it("should only allow outfits that are already on auction", async () => {
          // mints one outfit
          const newOutfitId = await Outfit.getNextOutfitId();
          const txResponse1 = await Outfit.connect(user1).mintOutfit();
          await txResponse1.wait(1);

          // get approval for Marketplace to handle transactions
          const txResponse2 = await Outfit.connect(user1).approve(
            Auction.address,
            outfitId
          );
          await txResponse2.wait(1);

          await expect(Auction.connect(user1).removeFromAuction(newOutfitId))
            .to.be.revertedWithCustomError(Auction, "Auction__NotOnAuction")
            .withArgs(newOutfitId);
        });

        it("should remove auction", async () => {
          const txResponse = await Auction.connect(user1).removeFromAuction(
            outfitId
          );
          await txResponse.wait(1);

          assert.equal(await Auction.isOutfitOnAuction(outfitId), false);
        });

        it("should remove outstanding balances from all bidders", async () => {
          const oldBalances = [];
          for (let bidder of bidders)
            oldBalances.push(
              await Users.connect(bidder).getOutstandingBalance()
            );

          const txResponse = await Auction.connect(user1).removeFromAuction(
            outfitId
          );
          await txResponse.wait(1);

          const newBalances = [];
          for (let bidder of bidders)
            newBalances.push(
              await Users.connect(bidder).getOutstandingBalance()
            );

          for (let index in bidders)
            assert.equal(
              oldBalances[index].sub(bids[index]).toString(),
              newBalances[index].toString()
            );
        });
      });

      describe("Getters", () => {
        describe("getOutfitEntry", () => {
          it("should check if outfit exists", async () => {
            const nonExistantId = await Outfit.getNextOutfitId();

            await expect(Auction.getOutfitEntry(nonExistantId))
              .to.be.revertedWithCustomError(
                Auction,
                "Auction__OutfitDoesNotExist"
              )
              .withArgs(nonExistantId);
          });

          it("should check if outfit is on auction", async () => {
            // mints one outfit
            const outfitId = await Outfit.getNextOutfitId();
            const txResponse1 = await Outfit.connect(user1).mintOutfit();
            await txResponse1.wait(1);

            // get approval for Marketplace to handle transactions
            const txResponse2 = await Outfit.connect(user1).approve(
              Marketplace.address,
              outfitId
            );
            await txResponse2.wait(1);

            await expect(Auction.getOutfitEntry(outfitId))
              .to.be.revertedWithCustomError(Auction, "Auction__NotOnAuction")
              .withArgs(outfitId);
          });
        });

        describe("_getMaxBid", () => {
          it("should return correct max bid", async () => {});
        });
      });
    })
  : describe.skip;
