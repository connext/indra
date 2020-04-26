import { IConnextClient, ConditionalTransferTypes, PublicParams, ClientOptions } from "@connext/types";
import { createClient, fundChannel, ETH_AMOUNT_MD, ETH_AMOUNT_SM, env } from "../util";
import { stringify, getRandomBytes32, ConsoleLogger } from "@connext/utils";
import axios from "axios";
import { soliditySha256 } from "ethers/utils";
import { providers } from "ethers";

describe.only("Experimental multihop tests", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let clientC: IConnextClient;
  const nodeBUrl = "http://172.17.0.1:8081";
  const provider = new providers.JsonRpcProvider(env.ethProviderUrl);
  const log = new ConsoleLogger("test", 4)

  before(async () => {
    clientA = await createClient();
    clientB = await createClient();
    clientC = await createClient({
      nodeUrl: nodeBUrl,
    });
    console.log(`ClientA: ${clientA.publicIdentifier}`)
    console.log(`NodeA: ${clientA.nodeIdentifier}`)
    console.log(`NodeB: ${clientC.nodeIdentifier}`)
    console.log(`ClientC: ${clientC.publicIdentifier}`)
    await fundChannel(clientA, ETH_AMOUNT_MD)
  });

  it("can create a  nodeA to nodeB channel", async () => {
    let nodeANodeBMultisig: string;
    try {
       nodeANodeBMultisig = await axios.post(`${nodeBUrl}/admin/nodetonode`, {
        userIdentifier: clientA.nodeIdentifier
      });
    } catch (e) {
      nodeANodeBMultisig = "";
    }
    console.log(`NodeToNode Multisig: ${nodeANodeBMultisig}`)
  })

  it.skip("clientA can transfer funds to clientB over nodeA", async() => {
    const preImage = getRandomBytes32();
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();
    const lockHash = soliditySha256(["bytes32"], [preImage]);
    const waitForInstall = new Promise(resolve => {
      clientB.on("CONDITIONAL_TRANSFER_CREATED_EVENT", data => {
        resolve();
      })
    })
    const transferInstallRet = await clientA.conditionalTransfer({
      amount: ETH_AMOUNT_SM.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer)
    await waitForInstall;
  })

  it("clientA can transfer funds to clientC over both nodeA and nodeB", async () => {
    const preImage = getRandomBytes32();
    const timelock = ((await provider.getBlockNumber()) + 5000).toString();
    const lockHash = soliditySha256(["bytes32"], [preImage]);
    const waitForInstall = new Promise(resolve => {
      clientC.on("CONDITIONAL_TRANSFER_CREATED_EVENT", data => {
        console.log(stringify(data))
        resolve();
      })
    })
    const transferInstallRet = await clientA.conditionalTransfer({
      amount: ETH_AMOUNT_SM.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      meta: { 
        path: [clientA.nodeIdentifier, clientC.nodeIdentifier, clientC.publicIdentifier], 
        sender: clientA.publicIdentifier,
      },
      recipient: clientC.publicIdentifier,
    } as PublicParams.HashLockTransfer)
    console.log(stringify(transferInstallRet))
    await waitForInstall;
  })
});
