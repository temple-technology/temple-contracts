# temple-contracts

This repo has the following contracts:
- SoulboundNFT contract to enable minting Abyss tokens
- Abyss NFT contract to allow users to mint and generate AI images

## SoulboundNFT 
This is a simple non-transferable NFT bound to a wallet. It represents a user character and is a requirement 
for minting Abyss NFT tokens.

## Abyss NFT
The Abyss NFT allows anyone with a SoulboundNFT to mint an Abyss NFT with a specific action id. 
Each user can mint only once within an epoch. A new epoch starts every 24 hours and gets reset 
from outside the network. Also each epoch has an associated URI.
The Abyss contract is part of the setup to support AI-generated images along with an offchain AI Agent.

# Quickstart
Tests and deployment are setup using hardhat development environment. Deployment particularly uses hardhat 
ignition modules. 
Deployments can be triggered directly using hardhat ignition commands. But it's recommended to use the 
scripts/deploy.ts script which automatically copies the deployment folder into a `deployments` repo 
to keep track of the deployed addresses and ABIs.

All commands are defined in the package.json file under the `scripts` section.

Start by running 
```
npm install
```

Then compile the contracts
```
npm run compile
```

And run the tests
```
npm run test
```

## Local deployment
Run a local node
```
npx hardhat node
```

Deploy to local node
```
npm run deploy-local
```

More detailed deployment instructions can be found in ./DEPLOYMENT_GUIDE.md.
