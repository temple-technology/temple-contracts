 
import { 
    http, 
    createPublicClient, 
    createWalletClient, 
    getContract } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia, hardhat } from 'viem/chains'
import fs from "fs";
import 'dotenv/config'

function readJsonFile(_filePath: string): any {
    try {
        const jsonData = fs.readFileSync(_filePath, 'utf-8');
        return JSON.parse(jsonData);
    } catch (error) {
        console.error('Error reading or parsing JSON file:', error);
        return null;
    }
}

const k = process.env.USER_PRIVATE_KEY
const account = privateKeyToAccount(`0x${k}`);
const abyssAddress: `0x${string}` = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const abiFile = 'ignition/deployments/chain-31337/artifacts/AbyssModule#Abyss.json';
const abi = readJsonFile(abiFile).abi;
const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(),
  }, );
const walletClient = createWalletClient({
    account: account,
    chain: hardhat,
    transport: http(),
});

const action = 1;
const scenario = 254;

async function mintAbyssToken() {
    try {      
        const hash = await walletClient.writeContract({
            address: abyssAddress,
            abi: abi,
            functionName: 'mint',
            args: [action],
            account,
        });
        console.log('Transaction sent:', hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log('Transaction confirmed in block', receipt.blockNumber);
    } catch (error) {
        console.error('Error executing multicall:', error);
    }
  }

  mintAbyssToken();