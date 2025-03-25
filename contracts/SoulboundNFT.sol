// contracts/SoulboundNFT.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./interfaces/IERC4671.sol";

contract SoulboundNFT is ERC721, Ownable2Step, Pausable, IERC4671 {
    uint256 private _tokenIdsCount;
    string private _baseTokenURI;

    event BaseURIUpdated(string newBaseURI);

    error Unauthorized();
    error AlreadyOwnsSoulboundToken();
    error SoulboundTokenNonTransferable();

    /**
     * @param name_ The name of the NFT collection.
     * @param symbol_ The symbol of the NFT collection.
     * @param owner The address of the contract owner.
     * @param baseURI The base URI for metadata.
     */
    constructor(
        string memory name_, 
        string memory symbol_, 
        address owner, 
        string memory baseURI
    ) ERC721(name_, symbol_) Ownable(owner) {
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Mints a soulbound NFT to the caller.
     * @dev A user can only mint one soulbound token.
     */
    function mint() external whenNotPaused {
        if (balanceOf(msg.sender) > 0) revert AlreadyOwnsSoulboundToken();
        
        _tokenIdsCount += 1;
        uint256 newTokenId = _tokenIdsCount;
        _safeMint(msg.sender, newTokenId);
        
        emit Minted(msg.sender, newTokenId);
    }

    /**
     * @notice Burns a soulbound NFT owned by the caller.
     * @param tokenId The ID of the token to be burned.
     * @dev Only the owner of the token can burn it.
     */
    function burn(uint256 tokenId) external whenNotPaused {
        address owner = _requireOwned(tokenId);
        if (owner != msg.sender) revert Unauthorized();
        
        emit Burned(owner, tokenId);
        _burn(tokenId);        
    }

    /**
     * @notice Returns the owner of a specific token.
     * @param tokenId The ID of the token.
     * @return The address of the token owner.
     */
    function ownerOf(uint256 tokenId) public view override(ERC721, IERC4671) returns (address) {
        return _ownerOf(tokenId);
    }

    /**
     * @notice Checks if a specific token ID is valid (exists).
     * @param tokenId The ID of the token.
     * @return True if the token exists, false otherwise.
     */
    function isValid(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /**
     * @notice Checks if a specific owner has a valid soulbound token.
     * @param owner The address to check.
     * @return True if the address owns a valid token, false otherwise.
     */
    function hasValid(address owner) external view returns (bool) {
        return balanceOf(owner) > 0;
    }

    /**
     * @notice Updates the base URI for metadata.
     * @param baseURI The new base URI.
     * @dev Can only be called by the contract owner.
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(baseURI);
    }

    /**
     * @notice Pauses minting and transfers
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses/resumes minting and transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Returns the base URI for metadata.
     * @return The base URI string.
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Updates the token ownership while preventing transfers.
     * @param to The new owner address.
     * @param tokenId The ID of the token.
     * @param auth Authorization address.
     * @return The new owner address.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (to != address(0) && _ownerOf(tokenId) != address(0)) revert SoulboundTokenNonTransferable();
        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Checks if the contract supports a specific interface.
     * @param interfaceId The interface identifier.
     * @return True if the interface is supported, false otherwise.
     */
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, IERC165) returns (bool) {
        return interfaceId == type(IERC4671).interfaceId || super.supportsInterface(interfaceId);
    }
}
