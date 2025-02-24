import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const UpgradeAbyssModule = buildModule("UpgradeAbyssModule", (m) => {
  // Deploy the new implementation contract
  const newAbyssImplementation = m.contract("Abyss");
  return { newAbyssImplementation };
});


export default UpgradeAbyssModule;