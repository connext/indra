const fs = require("fs");

const file = process.argv[2] || ".tps/all.log";

// console.log(`Reading tps data from file ${file}`);

const tpsData = fs.readFileSync(file, "utf8").split("\n").map(tx => parseInt(tx, 10)).filter(tx => !!tx).sort();

// console.log(`${JSON.stringify(tpsData, null, 2)}`);

const start = Math.floor(tpsData[0] / 1000);
const end = Math.floor(tpsData[tpsData.length - 1] / 1000);
const avgSpan = 5;

// console.log(`Calculating tps w/in window of ${end - start} seconds from ${start} until ${end}`);

const movingAverage = {};
for (let t = start; t <= end; t++) {
  movingAverage[t] = 0;
  tpsData.forEach(tx => {
    if (Math.abs((tx / 1000) - t) <= (avgSpan / 2)) {
      movingAverage[t] += (1/avgSpan);
    }
  });
}

let peak = start;

// Round numbers so output is a little prettier
Object.keys(movingAverage).forEach(key => {
  movingAverage[key] = Math.round(movingAverage[key] * 100) / 100;
  if (movingAverage[key] > movingAverage[peak]) {
    peak = key;
  }
});

console.log(`${avgSpan} second moving average TPS: ${JSON.stringify(movingAverage, null, 2)}`);

console.log(`Peak TPS: ${movingAverage[peak]} at ${peak}`);
