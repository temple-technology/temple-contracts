We use hardhat ignition modules to deploy the smart contracts in this repo.

## Direct deployment using the ignition modules
Execute this command
```
npx hardhat ignition deploy ignition/modules/<MODULE>.ts --network <TARGET_NETWORK> --parameters ignition/<PARAMS_FILE>.json --verify
```
Replace the values between < > brackets with the desired values.
TARGET_NETWORK is one of `arbitrum`, `arbitrumSepolia`, `sepolia` or `ethereum`
PARAMS_FILE: there are three files available in the ignition folder. Make sure to set the values you want for all the required params.

Example:
`npx hardhat ignition deploy ignition/modules/Abyss.ts --network arbitrumSepolia --parameters ignition/testnet_params.json --verify`
Here, the deployment uses the `AbyssProxyModule` params from the `testnet_params.json` file. It also uses 
the `SoulboundModule` params because it is a dependency of the Abyss contract.
This command will automatically verify the deployed contracts in etherscan explorer (arbiscan).

## Deployment using the deploy script
Execute this:
```
npm run deploy-<TARGET> 
```
Where TARGET is one of local, testnet, sepolia or mainnet

Please read the following sections before running the deployment script.

### Deployment config
This is a json file with the following schema:
```json
{
    "abyss": true
}
```
Use this to tell the script which contract modules to deploy, by default all modules are enabled.
The config file is in the `scripts` folder (deployment_config.json)

Notes:
- The Abyss contract deployment requires a SoulboundNFT contract address. If this is already deployed 
  and the deployment info is available at `ignition/deployment/chain-<id>` then the address will be 
  used from the old deployment. If deployment info is not available, a new SoulboundNFT contract will 
  be deployed.

### Environment variables 
Set the following env vars a .env file:
- DEPLOYER_PRIVATE_KEY -- required (ensure it has funds on the target chain)
- RPC: 
  - ARBITRUM_SEPOLIA_RPC -- arbitrum sepolia testnet
  - ARBITRUM_RPC --  arbitrum mainnet
  - SEPOLIA_RPC
- To verify deployments: 
  - ETHERSCAN_API_KEY -- ethereum sepolia or ethereum mainnet
  - ETHERSCAN_ARBITRUM_API_KEY -- arbitrum testnet or mainnet

### Deployment Parameters 
Each ignition module has deployment params that are read from a params json file. 
There are 3 params files in the ignition folder:
- local_params.json -- for local deployment to the hardhat node
- testnet_params.json -- used for both sepolia and arbitrumSepolia
- mainnet_params.json -- for arbitrum mainnet deployment

The params are grouped under the name of the deployment ignition module such as `AbyssProxyModule` for 
deployment of the Abyss contract.

### Saving deployment artifacts
Deployment data is saved under ignition/deployments/<chain-id> which is copied 
to the `deployments` repo using the env var `DEPLOYMENTS_REPO_PATH`.

Make sure to commit/push the new deployment folder to the deployments repo.

### Abyss contract upgrade
The Abyss NFT contract is upgradeable. The initial deployment can be done as described above.
To upgrade this contract, 
To upgrade the Abyss contract, run the upgrade script 
`npm run upgrade-abyss-testnet/mainnet/sepolia`

The upgrade script assumes the upgrade has to go through a multisig account.
The upgrade requires the following:
- SAFE_ADDRESS -- address of the Safe wallet. Must be already the owner of the ProxyAdmin contract.
  Either set the `proxyAdminOwner` (in the parameters file) to this address, or transfer ownership after deployment.
- DEPLOYER_ADDRESS -- address of a signer in the Safe wallet
- ETHEREUM_RPC -- must match the target chain 
- DEPLOYER_PRIVATE_KEY -- key of a signer in the Safe wallet, must match the DEPLOYER_ADDRESS
- PROXY_ADDRESS -- address of the `TransparentUpgradeableProxy` contract that is produced from the AbyssProxy deployment
  Find this in `ignition/deployments/<chain-id>/deployed_addresses.json`
- PROXY_ADMIN_ADDRESS -- address of the `ProxyAdmin` contract that is produced from the AbyssProxy deployment
  Find this in `ignition/deployments/<chain-id>/deployed_addresses.json`
