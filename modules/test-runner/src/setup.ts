/* global before, after */
import { connectDb, disconnectDb } from "./util";

before("Global Setup", async () => {
  await connectDb();
});

after("Global Teardown", async () => {
  await disconnectDb();
});
