import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { checksumAddress, zeroAddress } from "viem";
import hre from "hardhat";

describe("Apostles", function () {
  async function deployContract() {
    const [owner, admin, user1, user2] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const contract = await hre.viem.deployContract("Apostles", 
        [
            "Apostles NFT", 
            "APS", 
            "An Apostles NFT member.", 
            owner.account.address,
            BigInt(500),
            owner.account.address, 
            admin.account.address,
            "https://example.com/metadata/"]
      );
  
    return { contract, owner, admin, user1, user2, publicClient };
  }

  it("Should mint an NFT successfully", async function () {
    const { contract, admin, user1 } = await loadFixture(deployContract);

    await expect(
      contract.write.mint(["User One", "ipfs://Qm...imagehash", user1.account.address], { account: admin.account })
    )
      .to.emit(contract, "Transfer")
      .withArgs(zeroAddress, checksumAddress(user1.account.address), 1);

    const metadata = await contract.read.tokenURI([1]);
    expect(metadata).to.include("data:application/json;base64,");
  });

  it("Should revert minting from a non-minter account", async function () {
    const { contract, admin, user1, user2 } = await loadFixture(deployContract);

    await expect(
      contract.write.mint(["User one", "ipfs://Qm...imagehash", user2.account.address], { account: user1.account })
    ).to.be.revertedWithCustomError({ abi: contract.abi }, "AccessControlUnauthorizedAccount");
  });

  it("Should return correct metadata for a minted NFT", async function () {
    const { contract, admin, user1 } = await loadFixture(deployContract);

    await contract.write.mint(["User 2", "ipfs://Qm...imagehash", user1.account.address], { account: admin.account });

    const metadata = await contract.read.tokenURI([1]);
    console.log(`metadata >>>>>>>>>> ${metadata}`);
    expect(metadata).to.include("data:application/json;base64,");
    const base64Data = metadata.replace(/^data:application\/json;base64,/, "");
    const jsonString = Buffer.from(base64Data, "base64").toString("utf-8");
    // Parse JSON
    const decodedMetadata = JSON.stringify(JSON.parse(jsonString));
    expect(decodedMetadata).to.include("User 2");
    expect(decodedMetadata).to.include("ipfs://Qm...imagehash");
  });

  it("Should revert when querying metadata for non-existent NFT", async function () {
    const { contract } = await loadFixture(deployContract);

    await expect(contract.read.tokenURI([99])).to.be.revertedWithCustomError({ abi: contract.abi }, "UnknownToken");
  });

  it("Should transfer an NFT", async function () {
    const { contract, admin, user1, user2 } = await loadFixture(deployContract);

    await contract.write.mint(["User one", "ipfs://Qm...imagehash", user1.account.address], { account: admin.account });

    await expect(
      contract.write.transferFrom([user1.account.address, user2.account.address, 1], { account: user1.account })
    )
      .to.emit(contract, "Transfer")
      .withArgs(checksumAddress(user1.account.address), checksumAddress(user2.account.address), 1);

    const newOwner = await contract.read.ownerOf([1]);
    expect(newOwner).to.equal(checksumAddress(user2.account.address));
  });

  it("Should revert unauthorized transfers", async function () {
    const { contract, admin, user1, user2 } = await loadFixture(deployContract);

    await contract.write.mint(["User 1", "ipfs://Qm...imagehash", user1.account.address], { account: admin.account });

    await expect(
      contract.write.transferFrom([user1.account.address, user2.account.address, 1], { account: admin.account })
    ).to.be.revertedWithCustomError({ abi: contract.abi }, "ERC721InsufficientApproval");
  });
});
