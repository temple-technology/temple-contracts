import * as fs from "fs";
import * as path from "path";
require("dotenv").config();

type ApostlesParams = {
    name: string;
    symbol: string;
    description: string;
    royaltyRecipient: string;
    royaltiesBasisPoints: number;
    ownerAddress: string;
    adminAddress: string;
    contractURI: string;
}

type SoulboundParams = {
    name: string;
    symbol: string;
    ownerAddress: string;
    baseURI: string;
  }

type AbyssProxyParams = {
    name: string;
    symbol: string;
    royaltyRecipient: string;
    royaltiesBasisPoints: number;
    ownerAddress: string;
    adminAddress: string;
    resetterAddress: string;
    contractURI: string;
    baseURI: string;
    proxyAdminOwner: string;
}

type DeploymentParams = {
    ApostlesModule: ApostlesParams;
    SoulboundModule: SoulboundParams;
    AbyssProxyModule: AbyssProxyParams;
}

export function readDeploymentParams(chainId: number | undefined) :DeploymentParams | undefined {
    const ignitionDir = path.join(__dirname, "../ignition/");

    let paramsFilePath = process.env.IGNITION_PARAMS_FILE || "";
    if (paramsFilePath === "") {
        let paramsFile = "local_params.json";
        if (chainId === 11155111 || chainId === 421614) {
            paramsFile = "testnet_params.json";
        } else if (chainId == 42161) {
            paramsFile = "mainnet_params.json";
        }
        paramsFilePath = path.join(ignitionDir, paramsFile);
    }

    if (!fs.existsSync(paramsFilePath)) {
        console.warn(`Warning: Parameters file not found at ${paramsFilePath}, using default values.`);
        return;    
    }

    console.log(`Loading params from ${paramsFilePath}, chainId ${chainId}`);
    let params: DeploymentParams = JSON.parse(fs.readFileSync(paramsFilePath, "utf-8"));
    // console.debug("Using deployment parameters:", params);
    return params;
}