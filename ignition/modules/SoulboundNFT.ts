// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SoulboundModule = buildModule("SoulboundModule", (m) => {
  const name = m.getParameter("name", "AbyssSoul");
  const symbol = m.getParameter("symbol", "ABSOUL");
  const ownerAddress = m.getParameter("ownerAddress", process.env.CONTRACT_OWNER_ADDRESS);
  const baseURI = m.getParameter("baseURI", "");

  let soulNFT = m.contract("SoulboundNFT", [
    name,
    symbol,
    ownerAddress,
    baseURI
  ]);
  
  return { soulNFT };
});

export default SoulboundModule;
