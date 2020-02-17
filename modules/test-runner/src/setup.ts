import { after, before } from "mocha";

import { connectDb, disconnectDb } from "./util";

before(async () => {
  await connectDb();
  console.log("DB Connected!");
});

after(async () => {
  await disconnectDb();
  console.log("DB Disconnected!");
});
