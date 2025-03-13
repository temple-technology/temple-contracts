import { Chain, createPublicClient, createWalletClient, http } from "viem";
import hre from "hardhat";
import UpgradeAbyssModule from "../ignition/modules/AbyssUpgrade";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia, mainnet, sepolia, hardhat } from 'viem/chains'

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

*/

const upgradeAbyssContract = async () => {
    const { newAbyssImplementation } = await hre.ignition.deploy(UpgradeAbyssModule);
    console.log(`deployed Abyss contract: ${newAbyssImplementation.address}`);
    
    const proxyAddress: `0x${string}` = `0x${(process.env.PROXY_ADDRESS || "0x").slice(2)}`;
    const proxyAdminAddress: `0x${string}` = `0x${(process.env.PROXY_ADMIN_ADDRESS || "0x").slice(2)}`;

    const abi = [
        {
            "inputs": [
                { "internalType": "address", "name": "proxy", "type": "address" },
                { "internalType": "address", "name": "implementation", "type": "address" },
                { "internalType": "bytes", "name": "data", "type": "bytes" }
            ],
            "name": "upgradeAndCall",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]

    const k = process.env.DEPLOYER_PRIVATE_KEY;
    const account = privateKeyToAccount(`0x${k}`);
    let chainId = hre.network.config.chainId;
    let chain: Chain | undefined; 

    if (chainId === 11155111) {
        chain = sepolia;
    } else if (chainId === 42161) {
        chain = arbitrum
    } else if (chainId === 421614) {
        chain = arbitrumSepolia
    } else if (chainId === 1) {
        chain = mainnet
    } else {
        chain = hardhat;
    }

    const publicClient = createPublicClient({
        chain,
        transport: http(),
      }, );
    const walletClient = createWalletClient({
        account: account,
        chain: hardhat,
        transport: http(),
    });

    try {      
        const hash = await walletClient.writeContract({
            address: proxyAdminAddress,
            abi: abi,
            functionName: 'upgradeAndCall',
            args: [proxyAddress, newAbyssImplementation.address, "0x"],
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