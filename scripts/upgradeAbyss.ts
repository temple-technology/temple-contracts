import { exit } from "process";
import { Chain, createPublicClient, createWalletClient, http } from "viem";
import hre from "hardhat";
import UpgradeAbyssModule from "../ignition/modules/AbyssUpgrade";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia, mainnet, sepolia, hardhat, sonic, sonicBlazeTestnet } from 'viem/chains'

/*
  Use this script to upgrade the Abyss contract when the ProxyAdmin owner is an EOA wallet.
  If the owner is a Safe/Multisig wallet use the upgradeAbyssMultisig.ts script.

  Required env vars:
    DEPLOYER_PRIVATE_KEY
    PROXY_ADDRESS
    PROXY_ADMIN_ADDRESS

  Supported chains:
    sepolia
    arbitrumSepolia
    mainnet
    arbitrum

  Set this envvar if the new implementation contract is already deployed 
    (this will skip deploying a new Abyss contract)
    NEW_ABYSS_IMPLEMENTATION
*/

const ABI = [
    {
        "inputs": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          }
        ],
        "name": "OwnableInvalidOwner",
        "type": "error"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "account",
            "type": "address"
          }
        ],
        "name": "OwnableUnauthorizedAccount",
        "type": "error"
      },
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },      
    {
        "inputs": [
          {
            "internalType": "contract ITransparentUpgradeableProxy",
            "name": "proxy",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "implementation",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "data",
            "type": "bytes"
          }
        ],
        "name": "upgradeAndCall",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      }

]

const upgradeAbyssContract = async () => {
    let newAddress = process.env.NEW_ABYSS_IMPLEMENTATION;
    if (newAddress === "" || newAddress === undefined) {
        const { newAbyssImplementation } = await hre.ignition.deploy(UpgradeAbyssModule);
        console.log(`deployed Abyss contract: ${newAbyssImplementation.address}`);
        newAddress = newAbyssImplementation.address;
    }
    
    const proxyAddress: `0x${string}` = `0x${(process.env.PROXY_ADDRESS || "0x").slice(2)}`;
    const proxyAdminAddress: `0x${string}` = `0x${(process.env.PROXY_ADMIN_ADDRESS || "0x").slice(2)}`;

    const k = process.env.DEPLOYER_PRIVATE_KEY;
    const account = privateKeyToAccount(`0x${k}`);
    let chainId = hre.network.config.chainId;
    let chain: Chain | undefined; 

    if (chainId === 11155111) {
        chain = sepolia;
    } else if (chainId === 42161) {
        chain = arbitrum;
    } else if (chainId === 421614) {
        chain = arbitrumSepolia;
    } else if (chainId === 1) {
        chain = mainnet;
    } else if (chainId === 146) {
        chain = sonic;
    } else if (chainId === 57054) {
        chain = sonicBlazeTestnet;
    } else {
        chain = hardhat;
    }

    const publicClient = createPublicClient({
        chain,
        transport: http(),
      }, );
    const walletClient = createWalletClient({
        account: account,
        chain,
        transport: http(),
    });

    console.log(`### upgrading Abyss implementation: ### `);
    console.log(`  chain: ${chainId}`);
    console.log(`  proxy owner account: ${account.address}`);
    console.log(`  ProxyAddress: ${proxyAddress}`);
    console.log(`  ProxyAdminAddress: ${proxyAdminAddress}`);
    console.log(`  new Implementation: ${newAddress}`);

    // Check the owner of the ProxyAdmin
    const owner = await publicClient.readContract({
        address: proxyAdminAddress,
        abi: ABI,
        functionName: "owner",
        args: []
    });

    if (owner !== account.address) {
        console.error(`account is not the proxyAdmin owner, the upgrade will fail:`);
        console.error(`  upgrade is using this account: ${account.address}`)
        console.error(`  only this account can perform the upgrade: ${owner}`)
        exit();
    }

    try {      
        const hash = await walletClient.writeContract({
            address: proxyAdminAddress,
            abi: ABI,
            functionName: 'upgradeAndCall',
            args: [proxyAddress, newAddress, "0x"],
            account,
        });
        console.log('Abyss upgrade transaction sent:', hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log('Transaction confirmed in block', receipt.blockNumber);
    } catch (error) {
        console.error('Error executing multicall:', error);
    }

    return ;
}

upgradeAbyssContract().catch(console.error)