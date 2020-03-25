import { after, before } from "mocha";
import { connectDb, disconnectDb, connectNats, closeNats } from "./util";

before(async () => {
  await connectDb();
  await connectNats();
});

after(async () => {
  await disconnectDb();
  closeNats();
});
