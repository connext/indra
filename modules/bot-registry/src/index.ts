import { ColorfulLogger } from "@connext/utils";
import express from "express";
import bodyParser from "body-parser";

let bots = new Set();

const app = express();
app.use(bodyParser.json());
const port = 3333;

const log = new ColorfulLogger("Bot Registry", 3, true);

app.get("/agent", async (req, res) => {
  const botsArray = Array.from(bots);
  log.info(`Returning botsArray: ${botsArray}`);
  res.json(Array.from(bots));
});

app.post("/agent", async (req, res) => {
  const signerAddress = req.body.signerAddress;
  log.info(`Registering signerAddress: ${signerAddress}`);
  if (!signerAddress) {
    return res.status(400).send("No signer specified");
  }
  bots.add(signerAddress);

  return res.send(signerAddress);
});

app.delete("/agent", async (req, res) => {
  const signerAddress = req.body.signerAddress;
  if (!signerAddress) {
    log.info(`Clearing registry`);
    bots.clear();
    return res.send();
  }
  log.info(`Removing signerAddress: ${signerAddress}`);
  bots.delete(signerAddress);
  return res.send(signerAddress);
});

const start = async () => {
  app.listen(port, () => console.log(`Bot registry listening at http://localhost:${port}`));
};
start();
