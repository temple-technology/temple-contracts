 
import { 
    http, 
    createPublicClient, 
    createWalletClient, 
    getContract,
    parseUnits,
    parseEventLogs,
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
    chain: targetChain,
    transport: http(),
  }, );
const walletClient = createWalletClient({
    account: account,
    chain: targetChain,
    transport: http(),
});

const action = 1;

async function mintAbyssToken(fee: string) {
    try {      
        const hash = await walletClient.writeContract({
            address: abyssAddress,
            abi: abi,
            functionName: 'mint',
            args: [action],
            account,
            value: parseUnits(fee, 18)
        });
        console.log('Transaction sent:', hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log('"mint" transaction confirmed in block', receipt.blockNumber);
        // const logs = parseEventLogs({abi, eventName: "Reroll", logs: receipt.logs});
        // const { tokenId } = logs[0].args;

        // return tokenId;
    } catch (error) {
        console.error('Error executing multicall:', error);
    }
}

mintAbyssToken("0.002");