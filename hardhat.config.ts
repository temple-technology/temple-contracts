import type { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "hardhat-chai-matchers-viem";
import 'dotenv/config'

const deployer = process.env.DEPLOYER_PRIVATE_KEY || ""
const etherscanAPIKey = process.env.ETHERSCAN_API_KEY || ""
const etherscanArbitrumAPIKey = process.env.ETHERSCAN_ARBITRUM_API_KEY || ""
const etherscanSonicAPIKey = process.env.ETHERSCAN_SONIC_API_KEY || ""

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: "hardhat",
  sourcify: {
    enabled: true
  },
  networks: {
    hardhat: {
    },
    arbitrumSepolia: {
      chainId: 421614,
      url:  process.env.ARBITRUM_SEPOLIA_RPC || "https://arbitrum-sepolia.gateway.tenderly.co",
      accounts: [deployer]
    },
    arbitrum: {
      chainId: 42161,
      url: process.env.ARBITRUM_RPC || "https://arbitrum.llamarpc.com",
      accounts: [deployer]
    },
    sepolia: {
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC || "",
      accounts: [deployer],
    },
    sonicBlaze: {
      chainId: 57054,
      url: process.env.SONIC_BLAZE_RPC || "https://rpc.blaze.soniclabs.com",
      accounts: [deployer]
    },
    sonic: {
      chainId: 146,
      url: process.env.SONIC_RPC || "https://rpc.soniclabs.com",
      accounts: [deployer]
    }
  },
  etherscan: {
    apiKey: {
      arbitrumOne: etherscanArbitrumAPIKey,
      arbitrumGoerli: etherscanArbitrumAPIKey,
      arbitrumSepolia: etherscanArbitrumAPIKey,
      sepolia: etherscanAPIKey,
      sonic: etherscanSonicAPIKey,
      sonicBlaze: etherscanSonicAPIKey
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io/",
        }
      },
      {
        network: "sonicBlaze",
        chainId: 57054,
        urls: {
          apiURL: "https://api-testnet.sonicscan.org/api",
          browserURL: "https://testnet.sonicscan.org/",
        }
      },
      {
        network: "sonic",
        chainId: 146,
        urls: {
          apiURL: "https://api.sonicscan.org/api",
          browserURL: "https://sonicscan.org/",
        }
      }
    ]
  },
};

export default config;
