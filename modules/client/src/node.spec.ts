import { Wallet } from "./wallet";
import { MockNodeClientApi, nodeUrl, MockNatsClient, MockWallet, } from "./testing/mocks";
import { Signer } from "ethers";
import { INodeApiClient, NodeApiClient } from "./node"

describe("NodeApiClient", () => {
  let nodeClient: INodeApiClient

  beforeEach(() => {
    nodeClient = new NodeApiClient({
      nodeUrl,
      nats: new MockNatsClient(),
      wallet: new MockWallet()
    })
    expect(nodeClient).toBeInstanceOf(INode)
    expect(nodeClient.wallet).toBeInstanceOf(Signer)
  })

  test("should call the config method properly", async () => {
    expect(nodeClient).toBeInstanceOf(Wallet)
  })


})