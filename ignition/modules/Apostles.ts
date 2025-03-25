// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ApostlesModule = buildModule("ApostlesModule", (m) => {
  const name = m.getParameter("name", "Apostles");
  const symbol = m.getParameter("symbol", "APS");
  const description = m.getParameter("description", "Apostles NFT ");
  const royaltyRecipient = m.getParameter("royaltyRecipient", "0x");
  const royaltiesBasisPoints = m.getParameter("royaltiesBasisPoints", BigInt(500));
  const contractURI = m.getParameter("contractURI", "");
  const ownerAddress = m.getParameter("ownerAddress", process.env.CONTRACT_OWNER_ADDRESS);
  const adminAddress = m.getParameter("adminAddress", process.env.CONTRACT_ADMIN_ADDRESS);

  const apostlesNFT = m.contract("Apostles", [
    name, 
    symbol,
    description,
    royaltyRecipient, 
    royaltiesBasisPoints, 
    ownerAddress, 
    adminAddress,
    contractURI]);
  
  return { apostlesNFT };
});

export default ApostlesModule;
