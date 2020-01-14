import { IConnextClient } from "@connext/types";

import { createClient } from "../util";

describe("Full Flow: Transfer", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  });

  test("User transfers to multiple clients", async () => {
    
  });
});
