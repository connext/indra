import { IConnextClient } from "@connext/types";
import { createClient, env } from "../util";
import { stringify } from "@connext/utils";

describe.only("Experimental multihop tests", () => {
    let clientA: IConnextClient;
    let clientB: IConnextClient;
    const nodeBUrl = "http://172.17.0.1:8081"

    beforeEach(async() => {
        clientA = await createClient()
    })

    it("clientB can connect to nodeB", async () => {
        console.log("here")
        clientB = await createClient({
            nodeUrl: nodeBUrl
        })
    })

    it("nodeA can create a channel with nodeB", async () => {
        console.log("here")
        const ret = await clientA.messaging.request("*.channel.createNodeToNode", 90000, {nodeBPubId: clientB.nodeIdentifier})
        console.log(stringify(ret))
    })
})