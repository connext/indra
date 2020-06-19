/* global before */
import { Contract, Event, Wallet, ContractFactory, providers, utils } from "ethers";

import { Echo, Proxy, ProxyFactory } from "../../artifacts";

import { expect, provider } from "../utils";

const { getAddress, keccak256, solidityKeccak256, solidityPack } = utils;

describe("ProxyFactory with CREATE2", () => {
  let wallet: Wallet;

  let pf: Contract;
  let echo: Contract;

  const create2 = (initcode: string, saltNonce: number = 0, initializer: string = "0x") => {
    return getAddress(
      solidityKeccak256(
        ["bytes1", "address", "uint256", "bytes32"],
        [
          "0xff",
          pf.address,
          solidityKeccak256(["bytes32", "uint256"], [keccak256(initializer), saltNonce]),
          keccak256(initcode),
        ],
      ).slice(-40),
    );
  };

  before(async () => {
    wallet = (await provider.getWallets())[0];
    pf = await new ContractFactory(ProxyFactory.abi, ProxyFactory.bytecode, wallet).deploy();

    echo = await new ContractFactory(Echo.abi, Echo.bytecode, wallet).deploy();
  });

  describe("createProxy", async () => {
    it("can be used to deploy a contract at a predictable address", async () => {
      const masterCopy = echo.address;

      const initcode = solidityPack(
        ["bytes", "uint256"],
        [`0x${Proxy.bytecode.replace(/^0x/, "")}`, echo.address],
      );

      const saltNonce = 0;

      const tx: providers.TransactionResponse = await pf.createProxyWithNonce(
        masterCopy,
        "0x",
        saltNonce,
      );

      const receipt = await tx.wait();

      const event: Event = (receipt as any).events.pop();

      expect(event.event).to.eq("ProxyCreation");
      expect(event.eventSignature).to.eq("ProxyCreation(address)");
      expect(event.args![0]).to.eq(create2(initcode, saltNonce));

      const echoProxy = new Contract(create2(initcode), Echo.abi, wallet);

      expect(await echoProxy.helloWorld()).to.eq("hello world");
    });
  });
});
