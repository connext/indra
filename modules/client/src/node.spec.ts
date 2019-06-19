import { nodeUrl, MockNatsClient, MockWallet } from "./testing/mocks";
import { NodeApiClient } from "./node";

describe("NodeApiClient", () => {
  let nodeClient: NodeApiClient;

  beforeEach(() => {
    nodeClient = new NodeApiClient({
      nodeUrl,
      nats: new MockNatsClient(),
      wallet: new MockWallet(),
    });
    expect(nodeClient).toBeInstanceOf(NodeApiClient);
  });

  test("should call the config method properly", async () => {
    jest.spyOn(nodeClient, "config");
    const message = await nodeClient.config();
    expect(nodeClient.config).toBeCalledTimes(1);
    expect(message).toStrictEqual({
      nodePublicIdentifier: "x-pubcooolstuffs", // x-pub of node
      chainId: "mocks", // network that your channel is on
      nodeUrl,
    });
  });
});
