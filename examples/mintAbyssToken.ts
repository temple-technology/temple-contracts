 
import { 
    http, 
    createPublicClient, 
    createWalletClient, 
    getContract, 
    parseUnits} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia, hardhat, sepolia } from 'viem/chains'
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
const abyssAddress: `0x${string}` = "0x5AD9Bc7018569a437e78275aC4872F3F43032497";
// const abiFile = 'ignition/deployments/chain-11155111/artifacts/AbyssModule#Abyss.json';
// const abi = readJsonFile(abiFile).abi;
const abi = [
    {
        "inputs": [
            {
            "internalType": "uint8",
            "name": "action",
            "type": "uint8"
            }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    }
  
]
const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  }, );
const walletClient = createWalletClient({
    account: account,
    chain: sepolia,
    transport: http(),
});

const action = 1;

async function mintAbyssToken() {
    try {      
        const hash = await walletClient.writeContract({
            address: abyssAddress,
            abi: abi,
            functionName: 'mint',
            args: [action],
            account,
            value: parseUnits("0.002", 18)
        });
        console.log('Transaction sent:', hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log('Transaction confirmed in block', receipt.blockNumber);
    } catch (error) {
        console.error('Error executing multicall:', error);
    }
  }

  mintAbyssToken();