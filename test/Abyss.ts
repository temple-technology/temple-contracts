import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { checksumAddress, parseUnits, zeroAddress } from "viem";
import hre from "hardhat";
import AbyssProxyModule from "../ignition/modules/Abyss";

describe("Abyss", function () {
  async function deployContracts() {
    const [deployer, admin, user1, user2, resetter] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const deployment = await hre.ignition.deploy(AbyssProxyModule,
      { 
        parameters: {
          "AbyssProxyModule": {
            name: "Abyss NFT",
            symbol: "ABYSS",
            royaltyRecipient: deployer.account.address,
            royaltiesBasisPoints: 500,
            ownerAddress: deployer.account.address,
            adminAddress: admin.account.address,
            resetterAddress: resetter.account.address,
            contractURI: "{}",
            baseURI: "templetechnology.xyz/token/",
            proxyAdminOwner: deployer.account.address
          },
          "SoulboundModule": {
            name: "AbyssSoul",
            symbol: "ABSOUL",
            ownerAddress:  deployer.account.address,
            baseURI: ""
          }
        }
      }
    );
    const contract = deployment.abyss;
    const soulboundNFT = deployment.soulNFT;
    await soulboundNFT.write.mint({account: user1.account});

    return { contract, soulboundNFT, deployer, admin, user1, user2, resetter, publicClient };
  }

  it("Should deploy the contract with correct initial settings", async function () {
    const { contract, deployer } = await loadFixture(deployContracts);

    const name = await contract.read.name();
    const symbol = await contract.read.symbol();
    const initialEpoch = await contract.read.epoch();
    const royaltyRecipient = await contract.read.royaltyRecipient();
    const royaltyBasisPoints = await contract.read.royaltyBasisPoints();
    const mintFee = parseUnits("7", 18);

    expect(name).to.equal("Abyss NFT");
    expect(symbol).to.equal("ABYSS");
    expect(initialEpoch).to.equal(1);
    expect(royaltyRecipient).to.equal(checksumAddress(deployer.account.address));
    expect(royaltyBasisPoints).to.equal(500);
    expect(await contract.read.mintFee()).to.equal(mintFee);

  });

  it("Should allow updating and reading the contract URI", async function () {
    const { contract, admin } = await loadFixture(deployContracts);

    // Update contract URI
    const newContractURI = "https://example.com/metadata/";
    // Verify the emitted event
    await expect(contract.write.updateContractURI([newContractURI], { account: admin.account }))
      .to.emit(contract, "ContractURIUpdated")
      .withArgs(newContractURI);

    // Verify the updated contract URI
    const retrievedContractURI = await contract.read.contractURI();
    expect(retrievedContractURI).to.equal(newContractURI);
  });

  it("Should emit correct values when minting a token", async function () {
    const { contract, admin, user1 } = await loadFixture(deployContracts);
    await contract.write.setMintFee([BigInt(0)], { account: admin.account })

    // Mint a token
    const action = 1;
    const tokenId = 1; // First token ID
    // Verify the emitted event
    await expect(contract.write.mint([action], { account: user1.account }))
      .to.emit(contract, "NFTMinted")
      .withArgs(action, checksumAddress(user1.account.address), tokenId, 1, 0);

    // Verify token ownership
    const owner = await contract.read.ownerOf([BigInt(tokenId)]);
    expect(owner).to.equal(checksumAddress(user1.account.address));
  });

  it("Should not allow minting by user without a soulbound NFT.", async function () {
    const { contract, soulboundNFT, admin, user1, user2 } = await loadFixture(deployContracts);
    await contract.write.setMintFee([BigInt(0)], { account: admin.account })

    // Mint a token
    const action = 1;
    const tokenId = 1; // First token ID
    // verify mint will revert 
    await expect(contract.write.mint([action], { account: user2.account }))
      .to.revertedWithCustomError({abi: contract.abi}, "FailedMintRequirements");

    await soulboundNFT.write.mint({account: user2.account});

    // now minting Abyss should succeed
    await expect(contract.write.mint([action], { account: user2.account }))
      .to.emit(contract, "NFTMinted")
      .withArgs(action, checksumAddress(user2.account.address), tokenId, 1, 0);

    // Verify token ownership
    const owner = await contract.read.ownerOf([BigInt(tokenId)]);
    expect(owner).to.equal(checksumAddress(user2.account.address));
  });

  it("Should revert with AlreadyMintedInCurrentEpoch when minting more than once in the same epoch", async function () {
    const { contract, admin, user1, resetter } = await loadFixture(deployContracts);
    await contract.write.setMintFee([BigInt(0)], { account: admin.account })

    // Mint a token
    const action = 1;
    await contract.write.mint([action], { account: user1.account });
  
    // Attempt to mint again in the same epoch
    await expect(contract.write.mint([action], { account: user1.account }))
      .to.be.revertedWithCustomError(contract, "FailedMintRequirements");
    
    await contract.write.resetEpoch([""], { account: resetter.account });
    
    // Mint again after epoch reset (should succeed) and verify the emitted event
    const tokenId = 2; // Second token ID
    await expect(contract.write.mint([action], { account: user1.account }))
      .to.emit(contract, "NFTMinted")
      .withArgs(action, checksumAddress(user1.account.address), tokenId, 2, 0);
  });

  it("Should handle pausing and unpausing the mint function.", async function () {
    const { contract, soulboundNFT, admin, user1, user2 } = await loadFixture(deployContracts);
    await contract.write.setMintFee([BigInt(0)], { account: admin.account })

    // initially the contract is Unpaused
    await expect(contract.write.mint([1], { account: user1.account }))
      .to.emit(contract, "NFTMinted")
      .withArgs(1,  checksumAddress(user1.account.address), 1, 1, 0);

    // Pause the contract
    await expect(contract.write.pause({ account: admin.account }))
      .to.emit(contract, "Paused")
      .withArgs(checksumAddress(admin.account.address));

    expect(await contract.read.paused()).to.be.equal(true);

    // Attempt to mint while paused
    await expect(contract.write.mint([1], { account: user2.account }))
      .to.be.revertedWithCustomError({abi: contract.abi}, "EnforcedPause");

    // transfer should still work while paused
    await expect(contract.write.transferFrom([user1.account.address, user2.account.address, BigInt(1)], { account: user1.account }))
      .to.emit(contract, "Transfer")
      .withArgs(checksumAddress(user1.account.address), checksumAddress(user2.account.address), 1);

    // Unpause the contract
    await expect(contract.write.unpause({ account: admin.account }))
      .to.emit(contract, "Unpaused")
      .withArgs(checksumAddress(admin.account.address));

    // Mint after unpausing
    await soulboundNFT.write.mint({account: user2.account});
    await expect(contract.write.mint([1], { account: user2.account }))
      .to.emit(contract, "NFTMinted")
      .withArgs(1,  checksumAddress(user2.account.address), 2, 1, 0);

  });

  it("Should allow epoch resetter to reset the epoch and emit correct values", async function () {
    const { contract, admin, resetter, publicClient } = await loadFixture(deployContracts);

    const epoch = await contract.read.epoch();
    // Reset the epoch
    await expect(contract.write.resetEpoch(["templetech.xyz/epoch99199"], { account: resetter.account }))
      .to.emit(contract, "Epoch")
      .withArgs(epoch + BigInt(1), checksumAddress(resetter.account.address), "templetech.xyz/epoch99199", (await publicClient.getBlock({ blockTag: "latest" })).timestamp+BigInt(1));

    // Verify the new epoch and emitted event
    const newEpoch = await contract.read.epoch();
    expect(newEpoch).to.equal(2);
  });

  it("Should revert with custom error for non-existent token URI access", async function () {
    const { contract } = await loadFixture(deployContracts);

    // Attempt to get token URI for a non-existent token
    await expect(contract.read.tokenURI([BigInt(1)]))
      .to.be.revertedWithCustomError(contract, "ERC721NonexistentToken");
  });

  it("Should allow admin to update royalty recipient and basis points", async function () {
    const { contract, admin, user1 } = await loadFixture(deployContracts);
  
    // Set new royalty recipient and basis points
    const newRecipient = checksumAddress(user1.account.address);
    const newBasisPoints = BigInt(750); // 7.5%
    
    // Verify the emitted event
    await expect(contract.write.setRoyaltyInfo([newRecipient, newBasisPoints], { account: admin.account }))
      .to.emit(contract, "RoyaltyInfoUpdated")
      .withArgs(newRecipient, newBasisPoints);
  
    // Verify the updated values
    const updatedRecipient = await contract.read.royaltyRecipient();
    const updatedBasisPoints = await contract.read.royaltyBasisPoints();
  
    expect(updatedRecipient).to.equal(newRecipient);
    expect(updatedBasisPoints).to.equal(newBasisPoints);
  });
  
  it("Should revert with InvalidRoyaltyRecipient when setting zero address as royalty recipient", async function () {
    const { contract, admin } = await loadFixture(deployContracts);
  
    // Attempt to set zero address as royalty recipient
    await expect(contract.write.setRoyaltyInfo(
      ["0x0000000000000000000000000000000000000000", BigInt(500)], 
      { account: admin.account }
    )).to.be.revertedWithCustomError(contract, "InvalidRoyaltyRecipient");
  });
  
  it("Should revert with RoyaltyBasisPointsExceedMax when setting basis points above 100%", async function () {
    const { contract, admin, user1 } = await loadFixture(deployContracts);
  
    // Attempt to set basis points greater than 10,000 (100%)
    await expect(contract.write.setRoyaltyInfo(
      [checksumAddress(user1.account.address), BigInt(10001)], 
      { account: admin.account }
    )).to.be.revertedWithCustomError(contract, "RoyaltyBasisPointsExceedMax");
  });
  
  it("Should revert with AlreadyMintedInCurrentEpoch when minting more than once in the same epoch", async function () {
    const { contract, admin, user1 } = await loadFixture(deployContracts);
    await contract.write.setMintFee([BigInt(0)], { account: admin.account })

    // Mint a token
    const action = 1;
    await contract.write.mint([action], { account: user1.account });
  
    // Attempt to mint again in the same epoch
    await expect(contract.write.mint([action], { account: user1.account }))
      .to.be.revertedWithCustomError(contract, "FailedMintRequirements");
  });
  
  it("Should allow minting again after resetting the epoch", async function () {
    const { contract, admin, user1, resetter } = await loadFixture(deployContracts);
    await contract.write.setMintFee([BigInt(0)], { account: admin.account })

    // Mint a token
    const action = 1;
    await contract.write.mint([action], { account: user1.account });
  
    // Attempt to mint again in the same epoch (should revert)
    await expect(contract.write.mint([action], { account: user1.account }))
      .to.be.revertedWithCustomError(contract, "FailedMintRequirements");
  
    // Reset the epoch
    await contract.write.resetEpoch([""], { account: resetter.account });
  
    // Mint again after epoch reset (should succeed) and verify the emitted event
    const tokenId = 2; // Second token ID
    const epoch = 2;
    await expect(contract.write.mint([action], { account: user1.account }))
      .to.emit(contract, "NFTMinted")
      .withArgs(action, checksumAddress(user1.account.address), tokenId, epoch, 0);
  });
  
  it("should allow the admin to update the mint fee", async function () {
    const { contract, admin, user1, publicClient } = await loadFixture(deployContracts);
    
    const newMintFee = parseUnits("0.00035", 18);
    await expect(contract.write.setMintFee([newMintFee], { account: admin.account }))
        .to.emit(contract, "MintFeeUpdated")
        .withArgs(newMintFee);
    
    const updatedFee = await contract.read.mintFee();
    expect(updatedFee).to.equal(newMintFee);
  });

  it("Should mint with the required mint fee", async function () {
    const { contract, admin, user1 } = await loadFixture(deployContracts);

    const newMintFee = parseUnits("0.00035", 18);
    await contract.write.setMintFee([newMintFee], { account: admin.account });

    // Mint a token
    const action = 1;

    // Verify the emitted event
    const tokenId = 1; // First token ID
    await expect(contract.write.mint([action], { account: user1.account, value: newMintFee}))
      .to.emit(contract, "NFTMinted")
      .withArgs(action, checksumAddress(user1.account.address), tokenId, 1, newMintFee);

    // Verify token ownership
    const owner = await contract.read.ownerOf([BigInt(tokenId)]);
    expect(owner).to.equal(checksumAddress(user1.account.address));
  });

  it("Should not mint when the required mint fee is not provided", async function () {
    const { contract, admin, user1 } = await loadFixture(deployContracts);

    const newMintFee = parseUnits("0.00035", 18);
    await contract.write.setMintFee([newMintFee], { account: admin.account });

    const action = 1;
    await expect(contract.write.mint([action], { account: user1.account, value: parseUnits("0.00030", 18)}))
      .to.be.revertedWithCustomError( {abi: contract.abi}, "MintFeeRequired");

  });

  it("should emit WithdrawFunds when the owner tries to withdraw zero ETH", async function () {
    const { contract, admin } = await loadFixture(deployContracts);

    await expect(contract.write.withdrawFunds([BigInt(0)], { account: admin.account }))
      .to.emit(contract, "WithdrawFunds")
      .withArgs(checksumAddress(admin.account.address), 0);
  });

  it("should revert if the owner tries to withdraw more than available balance", async function () {
    const { contract, admin } = await loadFixture(deployContracts);

    const excessiveAmount = parseUnits("10", 18); // Attempt to withdraw more than balance

    await expect(
        contract.write.withdrawFunds([excessiveAmount], { account: admin.account })
    ).to.be.revertedWithCustomError({abi: contract.abi}, "InsufficientBalance");
  });

  it("should allow the owner to withdraw a specific amount of contract funds", async function () {
    const { contract, deployer, admin, user1, publicClient } = await loadFixture(deployContracts);
    
    const newMintFee = parseUnits("0.00035", 18);
    await contract.write.setMintFee([newMintFee], { account: admin.account });

    // User mints an NFT, sending ETH to the contract
    await expect(contract.write.mint([1], { account: user1.account, value: newMintFee }))
        .to.emit(contract, "NFTMinted")
        .withArgs(1, checksumAddress(user1.account.address), 1, 1, newMintFee);

    // Get contract balance before withdrawal
    const contractBalanceBefore = await publicClient.getBalance({ address: contract.address });
    expect(contractBalanceBefore).to.equal(newMintFee);

    // Define a withdrawal amount (half of contract balance)
    const withdrawalAmount = newMintFee / 2n;

    // Withdraw funds
    await expect(contract.write.withdrawFunds([withdrawalAmount], { account: admin.account }))
        .to.emit(contract, "WithdrawFunds")
        .withArgs(checksumAddress(admin.account.address), withdrawalAmount);

    // Verify remaining balance
    const contractBalanceAfter = await publicClient.getBalance({ address: contract.address });
    expect(contractBalanceAfter).to.equal(newMintFee - withdrawalAmount);
  });

  it("Should mint without fee for whitelisted user", async function () {
    const { contract, admin, user1, user2, resetter } = await loadFixture(deployContracts);

    const root: `0x${string}` = "0xe5b6e3298144ffbc1521ae5d17fdce81184e774c84119e5d254141bd246c771f";
    const newMintFee = parseUnits("0.00035", 18);
    await contract.write.setMintFee([newMintFee], { account: admin.account });
    await contract.write.setMerkleRoot([root], { account: admin.account })

    // Mint a token
    const action = 1;
    const proof: `0x${string}`[] = ["0x895fcfca45b761f42d85849ce9d8b111905c7417e64dcc0738a7abbae89ad17e"]

    // Mint using the whitelisted method with merkle proof
    const tokenId = 1; // First token ID
    await expect(contract.write.mint([action, proof], { account: user1.account}))
      .to.emit(contract, "NFTMinted")
      .withArgs(action, checksumAddress(user1.account.address), tokenId, 1, 0);

    // mint with proof should fail for the wrong wallet
    await expect(contract.write.mint([action, proof], { account: user2.account}))
      .to.be.revertedWithCustomError({abi: contract.abi}, "InvalidProof");

    // check remaining free mints
    let freeMint = await contract.read.hasRemainingFreeMints([user1.account.address, proof]);
    expect(freeMint).to.equal(true);

    for (let i = 0; i < 4; i++) {
        await contract.write.resetEpoch([`${i+2}`], { account: resetter.account });
        await contract.write.mint([action, proof], { account: user1.account})
    }
    freeMint = await contract.read.hasRemainingFreeMints([user1.account.address, proof]);
    expect(freeMint).to.equal(false);

    await contract.write.resetEpoch([`${6}`], { account: resetter.account });
    // free mint should fail now
    await expect(contract.write.mint([action, proof], { account: user1.account}))
      .to.be.revertedWithCustomError({abi: contract.abi}, "FreeMintsExceeded");

    // mint with fee should work for this user
    await expect(contract.write.mint([action], { account: user1.account, value: newMintFee }))
      .to.emit(contract, "NFTMinted")
      .withArgs(action, checksumAddress(user1.account.address), 6, 6, newMintFee);

  });

  it("Should mint using the Alchemy feature to bypass the epoch restrictions", async function () {
    const { contract, admin, user1, user2, resetter } = await loadFixture(deployContracts);
    const alchemyFee = BigInt(0);
    await contract.write.setAlchemyFee([alchemyFee], { account: admin.account });
    await contract.write.setMintFee([alchemyFee], { account: admin.account });

    // mint a few tokens to use in testing the alchemy function
    const action = 1;
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    await contract.write.resetEpoch(["epoch 2"], { account: resetter.account });
    
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    await contract.write.resetEpoch(["epoch 3"], { account: resetter.account });
    
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    await contract.write.resetEpoch(["epoch 4"], { account: resetter.account });
    
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    await contract.write.resetEpoch(["epoch 5"], { account: resetter.account });
    
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    await contract.write.resetEpoch(["epoch 6"], { account: resetter.account });
    
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    // await contract.write.resetEpoch(["epoch 2"], { account: resetter.account });

    // alchemy-reroll in same epoch without fee
    await expect(contract.write.alchemy([BigInt(1), BigInt(2)], { account: user1.account }))
      .to.emit(contract, "Alchemy")
      .withArgs(checksumAddress(user1.account.address), 7, 6, 0, 1, 2);
    // using the same tokens again should fail
    await expect(contract.write.alchemy([BigInt(1), BigInt(2)], { account: user1.account }))
      .to.be.revertedWithCustomError({ abi: contract.abi }, "InvalidAlchemyTokens");

    // reroll again in the same epoch with unburned tokens
    await expect(contract.write.alchemy([BigInt(4), BigInt(3)], { account: user1.account }))
      .to.emit(contract, "Alchemy")
      .withArgs(checksumAddress(user1.account.address), 8, 6, 0, 4, 3);

    // update reroll fee
    const newRerollFee = parseUnits("0.00035", 18);
    await contract.write.setAlchemyFee([newRerollFee], { account: admin.account });

    // reroll without fee should fail
    await expect(contract.write.alchemy([BigInt(5), BigInt(6)], { account: user1.account }))
      .to.be.revertedWithCustomError( { abi: contract.abi }, "AlchemyFeeRequired");
    await expect(contract.write.alchemy([BigInt(5), BigInt(6)], { account: user1.account, value: parseUnits("0.00031", 18) }))
      .to.be.revertedWithCustomError( { abi: contract.abi }, "AlchemyFeeRequired");

    // reroll submitted from non-token-owner account should fail
    await expect(contract.write.alchemy([BigInt(5), BigInt(6)], { account: user2.account, value: newRerollFee }))
      .to.be.revertedWithCustomError( { abi: contract.abi }, "InvalidAlchemyTokens");

      // reroll with the required fee and token owner should succeed
    await expect(contract.write.alchemy([BigInt(5), BigInt(6)], { account: user1.account, value: newRerollFee }))
      .to.emit(contract, "Alchemy")
      .withArgs(checksumAddress(user1.account.address), 9, 6, newRerollFee, 5, 6)
      .to.emit(contract, "Transfer")
      .withArgs(checksumAddress(user1.account.address), zeroAddress, 5);

    // mint new tokens
    await contract.write.resetEpoch(["epoch 7"], { account: resetter.account });
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    await contract.write.resetEpoch(["epoch 8"], { account: resetter.account });
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    await contract.write.resetEpoch(["epoch 9"], { account: resetter.account });
    await contract.write.mint([action], { account: user1.account, value: BigInt(0)})
    await contract.write.resetEpoch(["epoch 10"], { account: resetter.account });
    // await contract.write.mint([action], { account: user1.account, value: BigInt(0)})

    // reroll in future epochs should succeed
    await expect(contract.write.alchemy([BigInt(10), BigInt(11)], { account: user1.account, value: newRerollFee }))
      .to.emit(contract, "Alchemy")
      .withArgs(checksumAddress(user1.account.address), 13, 10, newRerollFee, 10, 11);

  });

});
