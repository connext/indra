import { connectDb, disconnectDb } from "./util";

beforeAll(async () => {
  await connectDb();
  console.log("DB Connected!");
});

afterAll(async () => {
  await disconnectDb();
  console.log("DB Disconnected!");
});
