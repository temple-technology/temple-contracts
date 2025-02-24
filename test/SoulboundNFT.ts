import { expect } from "chai";
import { checksumAddress, keccak256, toBytes } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";

describe("SoulboundNFT", function () {
  async function deployContract() {
    const [owner, user1, user2] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    const contract = await hre.viem.deployContract("SoulboundNFT", 
      ["Soulbound NFT", "SBC", owner.account.address, "https://example.com/metadata/"]
    );

    return { contract, owner, user1, user2, publicClient };
  }

  it("should allow the owner to setBaseURI", async function () {
      const { contract, owner, publicClient } = await loadFixture(deployContract);
      const newBaseURI = "https://new-example.com/metadata/";
      
      await expect(contract.write.setBaseURI([newBaseURI], { account: owner.account }))
        .to.emit(contract, "BaseURIUpdated")
        .withArgs(newBaseURI);
  });

  it("should return correct owner of a token", async function () {
      const { contract, user1, publicClient } = await loadFixture(deployContract);
      
      const mintTx = await contract.write.mint({ account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      const tokenId = BigInt(1);
      const owner = await contract.read.ownerOf([tokenId]);
      expect(owner).to.equal(checksumAddress(user1.account.address));
  });

  it("should verify that a minted token is valid", async function () {
      const { contract, user1, publicClient } = await loadFixture(deployContract);
      
      const mintTx = await contract.write.mint({ account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      const tokenId = BigInt(1);
      const isValid = await contract.read.isValid([tokenId]);
      expect(isValid).to.be.true;
  });

  it("should verify that a user has a valid token", async function () {
      const { contract, user1, publicClient } = await loadFixture(deployContract);
      
      const mintTx = await contract.write.mint({ account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      const hasValid = await contract.read.hasValid([user1.account.address]);
      expect(hasValid).to.be.true;
  });

  it("should return correct metadata URI", async function () {
      const { contract, user1, publicClient } = await loadFixture(deployContract);
      
      const mintTx = await contract.write.mint({ account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      const tokenId = BigInt(1);
      const baseURI = "https://example.com/metadata/";
      const tokenURI = await contract.read.tokenURI([tokenId]);
      expect(tokenURI).to.equal(`${baseURI}${tokenId}`);
  });

  it("should prevent token transfers", async function () {
      const { contract, user1, user2, publicClient } = await loadFixture(deployContract);
      
      const mintTx = await contract.write.mint({ account: user1.account });
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      const tokenId = BigInt(1);
      await expect(
          contract.write.transferFrom([user1.account.address, user2.account.address, tokenId], { account: user1.account })
      ).to.be.revertedWithCustomError({ abi: contract.abi }, "SoulboundTokenNonTransferable");
  });
  
  it("should allow a user to mint a soulbound token", async function () {
      const { contract, user1, publicClient } = await loadFixture(deployContract);
      
      await expect(contract.write.mint({ account: user1.account }))
          .to.emit(contract, "Minted")
          .withArgs(checksumAddress(user1.account.address), BigInt(1));
      
      const balance = await contract.read.balanceOf([user1.account.address]);
      expect(balance).to.equal(1);
  });

  it("should prevent a user from minting more than one token", async function () {
      const { contract, user1, publicClient } = await loadFixture(deployContract);
      
      await expect(contract.write.mint({ account: user1.account }))
          .to.emit(contract, "Minted")
          .withArgs(checksumAddress(user1.account.address), 1);

      await expect(
          contract.write.mint( { account: user1.account })
      ).to.be.revertedWithCustomError({ abi: contract.abi }, "AlreadyOwnsSoulboundToken");
  });

  it("should allow a user to burn their token", async function () {
      const { contract, user1, publicClient } = await loadFixture(deployContract);
      
      await expect(contract.write.mint({ account: user1.account }))
          .to.emit(contract, "Minted")
          .withArgs(checksumAddress(user1.account.address), 1);
      
      const tokenId = BigInt(1); // Assuming the first minted token has ID 1
      await expect(contract.write.burn([tokenId], { account: user1.account }))
          .to.emit(contract, "Burned")
          .withArgs(checksumAddress(user1.account.address), tokenId);
      
      const balance = await contract.read.balanceOf([user1.account.address]);
      expect(balance).to.equal(0);
  });

  it("should prevent a user from burning another user's token", async function () {
      const { contract, user1, user2, publicClient } = await loadFixture(deployContract);
      
      await expect(contract.write.mint({ account: user1.account }))
          .to.emit(contract, "Minted")
          .withArgs(checksumAddress(user1.account.address), 1);
      
      const tokenId = BigInt(1);
      await expect(
          contract.write.burn([tokenId], { account: user2.account })
      ).to.be.revertedWithCustomError({ abi: contract.abi }, "Unauthorized");
  });
});
