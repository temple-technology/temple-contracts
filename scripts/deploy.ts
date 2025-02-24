import hre from "hardhat";
import AbyssModule from "../ignition/modules/Abyss";
import ApostlesModule from "../ignition/modules/Apostles";
import TokenModule from "../ignition/modules/TasteToken";
import StakingModule from "../ignition/modules/StakingNFT";
import * as fs from "fs";
import * as path from "path";
import { readDeploymentParams } from "../utils/params";
import { exit } from "process";
require("dotenv").config();

type DeploymentConfig = {
    apostles: boolean,
    abyss: boolean
}

async function runDeployments(config: DeploymentConfig) {
    console.log("Starting Ignition deployment...");

    // Read params for the target chain deployment
    const params = readDeploymentParams(hre.network.config.chainId);
    if (params === undefined) {
        return false;
    }
    if (!(config.apostles || config.abyss)) {
        console.log(`Nothing to deploy, all the deployment modules are set to false in the config file.`);
        return false;
    }

    // Execute the deployments
    if (config.apostles) {
        const { apostlesNFT } = await hre.ignition.deploy(ApostlesModule, {
            parameters: { "ApostlesModule": params.ApostlesModule}
        });
        console.debug(`  Deployed Apostles: ${apostlesNFT.address}`);
    }

    if (config.abyss) {
        // SoulboundNFT is deployed as part of the Abyss deployment
        const { abyss, proxy, proxyAdmin, soulNFT } = await hre.ignition.deploy(AbyssModule, { 
            parameters: { "AbyssProxyModule": params.AbyssProxyModule}
        });
        console.debug(`  Deployed Abyss: ${proxy.address}`);
    }

    console.log("Deployment successful!");
    
    await archiveDeployments();
    
    return true;
}

async function archiveDeployments() {
    const repoPath = process.env.DEPLOYMENTS_REPO_PATH;

    if (!repoPath) {
        console.error("Error: DEPLOYMENTS_REPO_PATH environment variable is not set.");
        return;
    }

    let chainId = hre.network.config.chainId;
    if (chainId == undefined) {
        chainId = 31337;
    }
    
    const srcDir = path.join(__dirname, `../ignition/deployments/chain-${chainId}`);
    const destDir = path.join(repoPath, `deployments-chain-${chainId}-${Date.now()}`);

    if (!fs.existsSync(srcDir)) {
        console.error("Error: Source deployments folder does not exist:", srcDir);
        return;
    }

    // Create the archive folder if it does not exist
    if (!fs.existsSync(repoPath)) {
        fs.mkdirSync(repoPath, { recursive: true });
    }

    try {
        fs.cpSync(srcDir, destDir, { recursive: true });
        console.log(`Deployments successfully archived to: ${destDir}`);
    } catch (error) {
        console.error("Error copying deployments folder:", error);
    }
}

const configFile = path.join(__dirname, "deployment_config.json");
if (!fs.existsSync(configFile)) {
    console.warn(`Warning: deployment config file not found at ${configFile}.`);
    exit(1);
}

const config: DeploymentConfig = JSON.parse(fs.readFileSync(configFile, "utf-8"));
runDeployments(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
