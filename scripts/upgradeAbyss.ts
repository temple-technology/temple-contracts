import { encodeFunctionData } from "viem";
import hre from "hardhat";
import UpgradeAbyssModule from "../ignition/modules/AbyssUpgrade";
import SafeApiKit from '@safe-global/api-kit'
import Safe from '@safe-global/protocol-kit'
import {
  MetaTransactionData,
  OperationType
} from '@safe-global/types-kit';

const submitSafeTx = async (proxyAdminAddress: `0x${string}`, txData: `0x${string}`) => {
    const safeAddress: `0x${string}` = `0x${(process.env.SAFE_ADDRESS || "").slice(2)}`;
    const signer: `0x${string}` = `0x${(process.env.DEPLOYER_ADDRESS || "").slice(2)}`;
    const rpc = process.env.ETHEREUM_RPC || ""
    
    const protocolKitOwner1 = await Safe.init({
        provider: rpc,
        signer: process.env.DEPLOYER_PRIVATE_KEY,
        safeAddress: safeAddress,
      })
    
    const safeTransactionData: MetaTransactionData = {
        to: proxyAdminAddress,
        value: BigInt(0).toString(),
        data: txData,
        operation: OperationType.Call
    }
      
    const safeTransaction = await protocolKitOwner1.createTransaction({
        transactions: [safeTransactionData]
    })
    const chainId = hre.network.config.chainId || 11155111;
    const apiKit = new SafeApiKit({
        chainId: BigInt(chainId)
      })
    const safeTxHash = await protocolKitOwner1.getTransactionHash(safeTransaction)
    const senderSignature = await protocolKitOwner1.signHash(safeTxHash)
    await apiKit.proposeTransaction({
        safeAddress,
        safeTransactionData: safeTransaction.data,
        safeTxHash,
        senderAddress: signer,
        senderSignature: senderSignature.data
      })

    console.log(`tx data: ${txData}`);
    console.log("✅ Safe transaction submitted");
}

const upgradeAbyssContract = async () => {
    const { newAbyssImplementation } = await hre.ignition.deploy(UpgradeAbyssModule);
    console.log(`deployed Abyss contract: ${newAbyssImplementation.address}`);
    
    const proxyAddress: `0x${string}` = `0x${(process.env.PROXY_ADDRESS || "0x").slice(2)}`;
    const proxyAdminAddress: `0x${string}` = `0x${(process.env.PROXY_ADMIN_ADDRESS || "0x").slice(2)}`;

    const upgradeTxData = encodeFunctionData({
        abi: [
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
        ],
        functionName: "upgradeAndCall",
        args: [proxyAddress, newAbyssImplementation.address, "0x"],
    });

    return await submitSafeTx(proxyAdminAddress, upgradeTxData);  
}

upgradeAbyssContract().catch(console.error)