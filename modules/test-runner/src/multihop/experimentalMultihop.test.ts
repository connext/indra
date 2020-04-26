import { IConnextClient } from "@connext/types";
import { createClient } from "../util";
import { stringify } from "@connext/utils";
import axios, { AxiosResponse } from "axios";

describe.only("Experimental multihop tests", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  const nodeBUrl = "http://172.17.0.1:8081";

  beforeEach(async () => {
    clientA = await createClient();
  });

  it("clientB can connect to nodeB", async () => {
    console.log("here");
    clientB = await createClient({
      nodeUrl: nodeBUrl,
    });
  });

  it("nodeA can create a channel with nodeB", async () => {
    console.log("here");
    const verifyResponse = await axios.post(`${nodeBUrl}/admin/nodetonode`, {
      userIdentifier: clientA.nodeIdentifier
    });
    console.log(stringify(verifyResponse));
  });
});
