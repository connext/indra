import { createClient } from "../util";
import { IConnextClient } from "@connext/types";

describe("Fast Signed Transfer", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
  });
});
