// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.27;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IERC4671 is IERC165 {
    /// Event emitted when a token `tokenId` is minted for `owner`
    event Minted(address owner, uint256 tokenId);
    /// Event emitted when a token `tokenId` is burned for `owner`
    event Burned(address owner, uint256 tokenId);

    /// @notice Get owner of a token
    /// @param tokenId Identifier of the token
    /// @return Address of the owner of `tokenId`
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Check if a token hasn't been revoked
    /// @param tokenId Identifier of the token
    /// @return True if the token is valid, false otherwise
    function isValid(uint256 tokenId) external view returns (bool);

    /// @notice Check if an address owns a valid token in the contract
    /// @param owner Address for whom to check the ownership
    /// @return True if `owner` has a valid token, false otherwise
    function hasValid(address owner) external view returns (bool);
}