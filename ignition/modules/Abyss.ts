// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import SoulboundModule from "./SoulboundNFT";

const abyssProxyModule = buildModule("AbyssProxyModule", (m) => {
    // This address is the owner of the ProxyAdmin contract,
    // so it will be the only account that can upgrade the proxy when needed.
    const proxyAdminOwner = m.getParameter("proxyAdminOwner", "");

    const name = m.getParameter("name", "Abyss NFT");
    const symbol = m.getParameter("symbol", "ABYSS");
    const royaltyRecipient = m.getParameter("royaltyRecipient", "0x");
    const royaltiesBasisPoints = m.getParameter("royaltiesBasisPoints", BigInt(500));
    const ownerAddress = m.getParameter("ownerAddress", process.env.CONTRACT_OWNER_ADDRESS);
    const adminAddress = m.getParameter("adminAddress", process.env.CONTRACT_ADMIN_ADDRESS);
    const resetterAddress = m.getParameter("resetterAddress", process.env.ABYSS_EPOCH_RESETTER_ADDRESS);
    const contractURI = m.getParameter("contractURI", "");
    const baseURI = m.getParameter("baseURI", "");
    const soulboundNFT = m.useModule(SoulboundModule);

    const abyssNFT = m.contract("Abyss");
    const call = m.encodeFunctionCall(abyssNFT, 'initialize', [
        name, 
        symbol, 
        royaltyRecipient, 
        royaltiesBasisPoints, 
        ownerAddress,
        adminAddress,
        resetterAddress,
        contractURI,
        baseURI,
        soulboundNFT.soulNFT
      ]);

    const proxy = m.contract("TransparentUpgradeableProxy", [
        abyssNFT,
        proxyAdminOwner,
        call,
    ]);

    const proxyAdminAddress = m.readEventArgument(
        proxy,
        "AdminChanged",
        "newAdmin"
    );

    // proxyAdmin is used later for upgrading the proxy contract
    const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress);
    const soulNFT = soulboundNFT.soulNFT
    return { proxyAdmin, proxy, soulNFT };
});

const AbyssModule = buildModule("AbyssModule", (m) => {
    const { proxy, proxyAdmin, soulNFT } = m.useModule(abyssProxyModule);

    // get the Abyss contract at the proxy address, i.e. treat the contract at the proxy address as an instance
    // of the Abyss contract
    const abyss = m.contractAt("Abyss", proxy);

    return { abyss, proxy, proxyAdmin, soulNFT };
});

export default AbyssModule;