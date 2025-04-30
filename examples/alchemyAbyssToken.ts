 
import { 
    http, 
    createPublicClient, 
    createWalletClient, 
    Chain} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sonic, sonicBlazeTestnet, sepolia } from 'viem/chains'
import fs from "fs";
import 'dotenv/config'

let targetChain: Chain;
if (process.env.TARGET_CHAIN == "sonicBlazeTestnet") {
    targetChain = sonicBlazeTestnet;
} else if (process.env.TARGET_CHAIN == "sonic") {
    targetChain = sonic;
} else if (process.env.TARGET_CHAIN == "sepolia") {
    targetChain = sepolia;
} else {
    targetChain = sonicBlazeTestnet;
}

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
            "internalType": "uint256",
            "name": "token1Id",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "token2Id",
            "type": "uint256"
          }
        ],
        "name": "alchemy",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      }  
  ]
const publicClient = createPublicClient({
    chain: targetChain,
    transport: http(),
  }, );
const walletClient = createWalletClient({
    account: account,
    chain: targetChain,
    transport: http(),
});

async function rerollToken(token1d: number, token2Id: number) {
    try {
        const hash = await walletClient.writeContract({
            address: abyssAddress,
            abi: abi,
            functionName: 'alchemy',
            args: [token1Id, token2Id],
            account,
        });
        console.log('"reroll" transaction sent:', hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log('Transaction confirmed in block', receipt.blockNumber);
    } catch (error) {
        console.error('Error executing multicall:', error);
    }
}

rerollToken(1, 2);