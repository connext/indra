import { after, before } from "mocha";
import { connectDb, disconnectDb } from "./util";

before(async () => {
  await connectDb();
});

after(async () => {
  await disconnectDb();
});
