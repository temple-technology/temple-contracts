// contracts/Apostles.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.27;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract Apostles is ERC721Enumerable, AccessControl, IERC2981, Ownable2Step {
    using Strings for uint256;

    struct NFTMetadata {
        string name;
        string imageURI;
    }

    mapping(uint256 => NFTMetadata) private _tokenMetadata;
    string private _contractURI;
    string private _description;

     // Royalties
    address public royaltyRecipient;
    uint256 public royaltyBasisPoints; // Basis points (1/100 of a percent)

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    // Events
    event NFTMinted(address indexed minter, address indexed receiver, string name, uint256 tokenId);
    event RoyaltyInfoUpdated(address recipient, uint256 basisPoints);
    event ContractURIUpdated(string newContractURI);

    // Errors
    error InvalidAddress();
    error InvalidRoyaltyRecipient();
    error RoyaltyBasisPointsExceedMax();
    error UnknownToken();

    constructor(
        string memory name,
        string memory symbol,
        string memory description,
        address _royaltyRecipient,
        uint256 _royaltyBasisPoints,
        address owner,
        address admin,
        string memory initContractURI
    ) ERC721(name, symbol) Ownable(owner) {
        if (admin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        royaltyRecipient = _royaltyRecipient;
        royaltyBasisPoints = _royaltyBasisPoints;
        _contractURI = initContractURI;
        _description = description;
    }

    /**
     * @dev Mint an NFT for a user name/wallet
     * @param _name The user name 
     * @param _imageURI The uri pointing to the image in this NFT
     * @param to address of the user wallet this token will be minted for
     */
    function mint(
        string memory _name, 
        string memory _imageURI, 
        address to
    ) external onlyRole(MINTER_ROLE) {
        uint256 tokenId = totalSupply() + 1;
        _tokenMetadata[tokenId] = NFTMetadata(_name, _imageURI);
        _safeMint(to, tokenId);

        emit NFTMinted(msg.sender, to, _name, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert UnknownToken();

        NFTMetadata memory metadata = _tokenMetadata[tokenId];
        string memory json = string(abi.encodePacked(
            '{"name":"', metadata.name,
            '","description":"Apostles NFT","image":"', metadata.imageURI,
            '"}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    /**
     * @dev Update the contract URI.
     * Can only be called by accounts with the ADMIN_ROLE.
     * @param _newContractURI The new contract URI.
     */
    function updateContractURI(string calldata _newContractURI) external onlyRole(ADMIN_ROLE) {
        _contractURI = _newContractURI;
        emit ContractURIUpdated(_newContractURI);
    }

    /**
     * @dev IERC2981: Get royalty information.
     * @param _tokenId Token ID for which royalty info is requested.
     * @param _salePrice Sale price to calculate royalties.
     * @return recipient Address of royalty recipient.
     * @return royaltyAmount Amount of royalty to pay.
     */
    function royaltyInfo(
        uint256 _tokenId,
        uint256 _salePrice
    ) external view override returns (address recipient, uint256 royaltyAmount) {
        _requireOwned(_tokenId);
        royaltyAmount = (_salePrice * royaltyBasisPoints) / 10_000;
        return (royaltyRecipient, royaltyAmount);
    }

    /**
     * @dev Update royalty recipient and basis points.
     * Can only be called by accounts with the ADMIN_ROLE.
     * @param _recipient Address of the new royalty recipient.
     * @param _basisPoints Royalty percentage in basis points (1% = 100 basis points).
     */
    function setRoyaltyInfo(address _recipient, uint256 _basisPoints) external onlyRole(ADMIN_ROLE) {
        if (_recipient == address(0)) {
            revert InvalidRoyaltyRecipient();
        }
        if (_basisPoints > 10_000) {
            revert RoyaltyBasisPointsExceedMax();
        }

        royaltyRecipient = _recipient;
        royaltyBasisPoints = _basisPoints;

        emit RoyaltyInfoUpdated(_recipient, _basisPoints);
    }

    /**
     * @dev IERC165: Check interface support.
     * @param interfaceId The interface ID to check.
     * @return True if the contract supports the given interface.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Enumerable, AccessControl, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

}
