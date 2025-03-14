// contracts/Abyss.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.27;

import "@openzeppelin/contracts/interfaces/IERC2981.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "solady/src/utils/MerkleProofLib.sol";

import "./SoulboundNFT.sol";

contract Abyss is Initializable,
    ERC721EnumerableUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC2981Upgradeable,
    Ownable2StepUpgradeable
{
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EPOCH_RESET_ROLE = keccak256("EPOCH_RESET_ROLE");

    uint256 private constant ACTION_MIN = 1;
    uint256 private constant ACTION_MAX = 3;
    uint256 private constant MAX_FREE_MINTS = 5;

    /// @dev The Merkle Root
    bytes32 private merkleRoot;

    string private _contractURI;
    string private _baseTokenURI;
    uint256 public receivedFees;
    uint256 public mintFee = 2_000_000_000_000_000;
    uint256 public epoch; // Current epoch for minting
    SoulboundNFT public soulboundNFT;
    mapping(address => uint256) public lastMintEpoch;
    /// @dev Mapping for already used free mint claims
    mapping(address => uint256) private claimedFreeMint;

    // Royalties
    address public royaltyRecipient;
    uint256 public royaltyBasisPoints; // Basis points (1/100 of a percent)

    // Events
    event Epoch(uint256 indexed index, address indexed caller, string uri, uint256 blockTimestamp);
    event NFTMinted(uint8 indexed action, address indexed caller, uint256 indexed tokenId, uint256 epoch, uint256 paidFee);
    event RoyaltyInfoUpdated(address indexed recipient, uint256 basisPoints);
    event ContractURIUpdated(string newContractURI);
    event BaseURIUpdated(string newBaseURI);
    event MintFeeUpdated(uint256 newFee);
    event WithdrawFunds(address indexed owner, uint256 amount);
    event SetMerkleRoot(bytes32 indexed newRoot, bytes32 indexed oldRoot);

    // Errors
    error InvalidAddress();
    error InvalidRoyaltyRecipient();
    error RoyaltyBasisPointsExceedMax();
    error FailedMintRequirements();
    error InsufficientBalance();
    error WithdrawFailed();
    error Unauthorized();
    error MintFeeRequired();
    error MerkleRootNotSet();
    error InvalidProof();
    error FreeMintsExceeded();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @param name The name of the NFT collection.
     * @param symbol The symbol of the NFT collection.
     * @param _royaltyRecipient The recipient of royalty fees.
     * @param _royaltyBasisPoints The percentage of royalties (in basis points).
     * @param owner The owner of the contract.
     * @param admin The administrator role.
     * @param epochResetter The address that can reset the epoch.
     * @param initContractURI The initial contract URI.
     * @param baseURI The base URI for token metadata.
     * @param _soulboundNFT The reference to the Soulbound NFT contract.
     */
    function initialize(
        string memory name,
        string memory symbol,
        address _royaltyRecipient,
        uint256 _royaltyBasisPoints,
        address owner,
        address admin,
        address epochResetter,
        string memory initContractURI,
        string memory baseURI,
        SoulboundNFT _soulboundNFT
    ) public initializer {
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __AccessControl_init();
        __Pausable_init();
        __Ownable2Step_init();

        if (admin == address(0)) revert InvalidAddress();
        if (epochResetter == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(EPOCH_RESET_ROLE, epochResetter);

        soulboundNFT = _soulboundNFT;
        royaltyRecipient = _royaltyRecipient;
        royaltyBasisPoints = _royaltyBasisPoints;
        _contractURI = initContractURI;
        _baseTokenURI = baseURI;
        epoch = 1;

        _transferOwnership(owner);
    }

    /**
     * @dev Increments the epoch and emits an event.
     * @param uri The new epoch metadata URI.
     */
    function resetEpoch(string memory uri) external onlyRole(EPOCH_RESET_ROLE) {
        epoch += 1;
        emit Epoch(epoch, msg.sender, uri, block.timestamp);
    }

    /**
     * @dev Sets the minting fee.
     * @param _newFee The new minting fee.
     */
    function setMintFee(uint256 _newFee) external onlyRole(ADMIN_ROLE) {
        mintFee = _newFee;
        emit MintFeeUpdated(_newFee);
    }

    /**
     * @param _root The Merkle Root 
     */
    function setMerkleRoot(
        bytes32 _root
    ) external onlyRole(ADMIN_ROLE) {
        emit SetMerkleRoot(_root, merkleRoot);
        merkleRoot = _root;
    }

    /**
     * @dev Withdraws funds from the contract.
     * @param amount The amount to withdraw.
     */
    function withdrawFunds(uint256 amount) external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        if (balance < amount) revert InsufficientBalance();

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert WithdrawFailed();

        emit WithdrawFunds(msg.sender, amount);
    }

    /**
     * @dev Mints a new NFT, enforcing epoch and soulbound token requirements.
     * @param action The action type associated with the mint.
     */
    function mint(uint8 action) external payable whenNotPaused {
        if (msg.value < mintFee) {
            revert MintFeeRequired();
        }

        receivedFees += msg.value;
        _mint(action);
    }

    /**
     * @dev Same as mint function above, but this allows free mint for allow-list of addresses
     * @param action The action type associated with the mint.
     * @param _proof merkle proof
     */
    function mint(uint8 action, bytes32[] calldata _proof) external payable whenNotPaused {
        if (merkleRoot == bytes32(0)) revert MerkleRootNotSet();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(_msgSender()))));
        if (!MerkleProofLib.verify(_proof, merkleRoot, leaf)) revert InvalidProof();
        if (claimedFreeMint[msg.sender] >= MAX_FREE_MINTS) revert FreeMintsExceeded();

        ++claimedFreeMint[msg.sender];
        _mint(action);
    }

    function _mint(uint8 action) internal {
        if (
            lastMintEpoch[msg.sender] >= epoch || 
            !soulboundNFT.hasValid(msg.sender) || 
            action < ACTION_MIN || action > ACTION_MAX
            ) {
            revert FailedMintRequirements();
        }

        uint256 tokenId = totalSupply() + 1;
        lastMintEpoch[msg.sender] = epoch;
        _safeMint(msg.sender, tokenId);

        emit NFTMinted(action, msg.sender, tokenId, epoch, msg.value);
    }

    function _update(address to, uint256 tokenId, address auth) internal virtual override whenNotPaused returns (address) {
        return super._update(to, tokenId, auth);
    }

    function hasRemainingFreeMints(address user, bytes32[] calldata _proof) external view returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(user))));     

        return MerkleProofLib.verify(_proof, merkleRoot, leaf) && claimedFreeMint[msg.sender] < MAX_FREE_MINTS;
    }

    /**
     * @dev Returns the contract URI.
     */
    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    /**
     * @dev Updates the contract URI.
     * @param _newContractURI The new contract metadata URI.
     */
    function updateContractURI(string calldata _newContractURI) external onlyRole(ADMIN_ROLE) {
        _contractURI = _newContractURI;
        emit ContractURIUpdated(_newContractURI);
    }

    /**
     * @dev Sets a new base URI for NFTs.
     * @param baseURI The new base token URI.
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(baseURI);
    }

    /**
     * @dev Returns the base URI.
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Returns royalty information.
     * @param _tokenId The token ID.
     * @param _salePrice The sale price.
     * @return recipient The royalty recipient.
     * @return royaltyAmount The royalty amount to be paid.
     */
    function royaltyInfo(
        uint256 _tokenId,
        uint256 _salePrice
    ) public view override returns (address recipient, uint256 royaltyAmount) {
        if (_ownerOf(_tokenId) == address(0)) {
            return (address(0), 0);
        }

        royaltyAmount = (_salePrice * royaltyBasisPoints) / 10_000;
        return (royaltyRecipient, royaltyAmount);
    }

    /**
     * @dev Updates the royalty recipient and basis points.
     * @param _recipient The new royalty recipient.
     * @param _basisPoints The royalty percentage in basis points.
     */
    function setRoyaltyInfo(address _recipient, uint256 _basisPoints) external onlyRole(ADMIN_ROLE) {
        if (_recipient == address(0)) revert InvalidRoyaltyRecipient();
        if (_basisPoints > 10_000) revert RoyaltyBasisPointsExceedMax();

        royaltyRecipient = _recipient;
        royaltyBasisPoints = _basisPoints;

        emit RoyaltyInfoUpdated(_recipient, _basisPoints);
    }

    /**
     * @dev Pauses minting and transfers.
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses minting and transfers.
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721EnumerableUpgradeable, AccessControlUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns the version of the contract.
     * @return The contract version.
     */
    function version() public pure virtual returns (string memory) {
        return "1.0.0";
    }
}
