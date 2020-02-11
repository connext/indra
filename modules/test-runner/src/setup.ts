import { connectDb, disconnectDb } from "./util";

before("Global Setup", async () => {
  await connectDb();
  console.log("DB Connected!");
});

after("Global Teardown", async () => {
  await disconnectDb();
  console.log("DB Disconnected!");
});
