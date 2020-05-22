import express from "express";
import bodyParser from "body-parser";

let bots = new Set();

const app = express();
app.use(bodyParser.json());
const port = 3333;

app.get("/", async (req, res) => {
  res.json(Array.from(bots));
});

app.post("/agent", async (req, res) => {
  const signerAddress = req.body.signerAddress;
  if (!signerAddress) {
    return res.status(400).send("No signer specified");
  }
  bots.add(signerAddress);

  return res.send(signerAddress);
});

app.delete("/agent", async (req, res) => {
  const signerAddress = req.body.signerAddress;
  if (!signerAddress) {
    bots.clear();
    return res.send();
  }
  bots.delete(signerAddress);
  return res.send(signerAddress);
});

const start = async () => {
  app.listen(port, () => console.log(`Bot registry listening at http://localhost:${port}`));
};
start();
