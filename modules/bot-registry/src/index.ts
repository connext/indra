import express from "express";
import { keys, setItem, clear, removeItem, init, getItem } from "node-persist";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());
const port = 3333;

app.get("/", async (req, res) => {
  const bots = await keys();
  res.json(bots);
});

app.post("/", async (req, res) => {
  console.log("req.body: ", req.body);
  const signerAddress = req.body.signerAddress;
  if (!signerAddress) {
    return res.status(400).send("No signer specified");
  }
  const existing = await getItem(signerAddress);
  if (!existing) {
    await setItem(signerAddress, true);
  }
  return res.send(signerAddress);
});

app.delete("/", async (req, res) => {
  const signerAddress = req.body.signerAddress;
  if (!signerAddress) {
    await clear();
    return res.send();
  }
  await removeItem(signerAddress);
  return res.send(signerAddress);
});

const start = async () => {
  await init();
  await clear();
  app.listen(port, () => console.log(`Bot registry listening at http://localhost:${port}`));
};
start();
