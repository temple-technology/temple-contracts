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
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "solady/src/utils/MerkleProofLib.sol";

import "./SoulboundNFT.sol";

contract Abyss is Initializable,
    ERC721EnumerableUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC2981Upgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EPOCH_RESET_ROLE = keccak256("EPOCH_RESET_ROLE");

    uint256 private constant ACTION_MIN = 1;
    uint256 private constant ACTION_MAX = 3;
    uint256 private constant MAX_FREE_MINTS = 5;
    uint256 private constant MAX_ROYALTY_BASIS_POINTS = 2000;

    /// @dev The Merkle Root
    bytes32 private merkleRoot;

    string private _contractURI;
    string private _baseTokenURI;
    uint256 public receivedFees;
    uint256 public mintFee;
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
    event AlchemyFeeUpdated(uint256 newFee);
    event Alchemy(address indexed caller, uint256 indexed tokenId, uint256 indexed epoch, uint256 paidFee, uint256 burnedToken1, uint256 burnedToken2);
    event SetEpochMintCap(uint256 indexed cap, uint256 indexed epoch);

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
    error AlchemyFeeRequired();
    error InvalidAlchemyTokens();
    error EpochMintCapExceeded();
    error InvalidMintCap();
    error MissingAdminOrUpgradeRole();

    bool public debugMode;
    uint256 public alchemyFee;
    uint256 public nextTokenId;
    bytes32 public constant UPGRADE_ROLE = keccak256("UPGRADE_ROLE");
    uint256 private epochStartToken;
    uint256 public epochMintCap; // Maximum mints per epoch

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
        __ReentrancyGuard_init();

        if (admin == address(0)) revert InvalidAddress();
        if (epochResetter == address(0)) revert InvalidAddress();
        if (_royaltyRecipient == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADE_ROLE, admin);
        _grantRole(EPOCH_RESET_ROLE, epochResetter);

        soulboundNFT = _soulboundNFT;
        royaltyRecipient = _royaltyRecipient;
        royaltyBasisPoints = _royaltyBasisPoints;
        _contractURI = initContractURI;
        _baseTokenURI = baseURI;
        mintFee = 7_000_000_000_000_000_000;
        alchemyFee = 4_000_000_000_000_000;
        nextTokenId = 1;
        epoch = 1;
        debugMode = false;
        epochStartToken = 1;
        epochMintCap = 3333;

        _transferOwnership(owner);
    }

    modifier onlyAdminOrUpgradeRoles() {
        if (!hasRole(ADMIN_ROLE, msg.sender) && !hasRole(UPGRADE_ROLE, msg.sender)) {
            revert MissingAdminOrUpgradeRole();
        }
        _;
    }

    function postUpgrade() external onlyAdminOrUpgradeRoles {
        if (nextTokenId <= 1 && totalSupply() > 0) {
            nextTokenId = totalSupply() + 1;
        }
        if (epochStartToken < 1) {
            epochStartToken = nextTokenId;
        }
    }

    /**
     * @dev Increments the epoch and emits an event.
     * @param uri The new epoch metadata URI.
     */
    function resetEpoch(string memory uri) external onlyRole(EPOCH_RESET_ROLE) {
        unchecked {
            epoch += 1;
        }
        epochStartToken = nextTokenId;
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
     * @dev Sets the Alchemy fee.
     * @param _newFee The new Alchemy fee.
     */
    function setAlchemyFee(uint256 _newFee) external onlyRole(ADMIN_ROLE) {
        alchemyFee = _newFee;
        emit AlchemyFeeUpdated(_newFee);
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
    function withdrawFunds(uint256 amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        uint256 balance = address(this).balance;
        if (balance < amount) revert InsufficientBalance();

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert WithdrawFailed();

        emit WithdrawFunds(msg.sender, amount);
    }

    function canMint(uint8 action, address minter) external view returns(bool) {
        return _checkMintRequirements(action, minter) == 0;
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
        _mintWithAction(action);
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

        unchecked {
            ++claimedFreeMint[msg.sender];
        }
        _mintWithAction(action);
    }

    function _mintWithAction(uint8 action) internal {
        uint8 r = _checkMintRequirements(action, msg.sender);
        if (r == 1) {
            revert FailedMintRequirements();
        } else if (r == 2) {
            revert EpochMintCapExceeded();
        }

        lastMintEpoch[msg.sender] = epoch;
        uint256 tokenId = _mintWithNoChecks();
        emit NFTMinted(action, msg.sender, tokenId, epoch, msg.value);
    }

    function _checkMintRequirements(uint8 action, address minter) internal view returns(uint8) {
        if (
            (lastMintEpoch[minter] >= epoch && !debugMode) ||
            !soulboundNFT.hasValid(minter) ||
            action < ACTION_MIN || action > ACTION_MAX
        ) {
            return 1;
        }

        if (nextTokenId > (epochStartToken + epochMintCap - 1)) return 2;

        return 0;
    }

    function _mintWithNoChecks() internal returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
        return tokenId;
    } 

    /**
     * @dev Mint a new NFT after burning 2 existing NFT cards
     * @param token1Id Id of an NFT to burn
     * @param token2Id Id of a second NFT to burn
     */
    function alchemy(uint256 token1Id, uint256 token2Id) external payable whenNotPaused {
        if (token1Id == token2Id || 
            _ownerOf(token1Id) != msg.sender || 
            _ownerOf(token2Id) != msg.sender
            ) {
            revert InvalidAlchemyTokens();
        }

        if (msg.value < alchemyFee) {
            revert AlchemyFeeRequired();
        }

        receivedFees += msg.value;

        _burn(token1Id);
        _burn(token2Id);
        uint256 newTokenId = _mintWithNoChecks();
        emit Alchemy(msg.sender, newTokenId, epoch, msg.value, token1Id, token2Id);
    }

    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        return super._update(to, tokenId, auth);
    }

    function setEpochMintCap(uint256 cap) external onlyRole(ADMIN_ROLE) {
        // A cap of zero, disables minting with action
        // This has no impact on the Alchemy minting
        if (cap > 1000000) revert InvalidMintCap();

        epochMintCap = cap;
        emit SetEpochMintCap(cap, epoch);
    }

    function remainingEpochMints() external view returns (uint256) {
        uint256 mintsThisEpoch =  nextTokenId - epochStartToken;
        return epochMintCap - mintsThisEpoch;
    }

    function hasRemainingFreeMints(address user, bytes32[] calldata _proof) external view returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(user))));

        return MerkleProofLib.verify(_proof, merkleRoot, leaf) && claimedFreeMint[user] < MAX_FREE_MINTS;
    }

    function tokenOwner(uint256 tokenId) external view returns (address) {
        return _ownerOf(tokenId);
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
        if (_basisPoints > MAX_ROYALTY_BASIS_POINTS) revert RoyaltyBasisPointsExceedMax();

        royaltyRecipient = _recipient;
        royaltyBasisPoints = _basisPoints;

        emit RoyaltyInfoUpdated(_recipient, _basisPoints);
    }

    function setDebugMode(bool _mode) external onlyRole(ADMIN_ROLE) {
        debugMode = _mode;
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
        return "1.0.1";
    }
}
