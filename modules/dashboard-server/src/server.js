const SQL = require("sql-template-strings");
const express = require("express");
const query = require("./db");

//express setup
const app = express();
const port = 9999;

//const contractAddress = '0x627306090abab3a6e1400e9345bc60c78a8bef57';

// Helper function: log each outgoing response before sending
const sendAndLog = (req, res, data) => {
  if (typeof data == "object") {
    data = JSON.stringify(data);
  }
  console.log(
    `=> ${req.method} ${req.url} => (200) Sent ${data.length} char${
      data.length === 1 ? "" : "s"
    } of data`
  );
  res.status(200).send(data);
};

// if theres only one item, and you dont want to use a list
async function sendResFromQuery(sqlStr, req, res, singleRowAsObj = true) {
  const data = await query(`${sqlStr}`)
  if (data) {
    const toSend = data.rowCount == 1 && singleRowAsObj ? data.rows[0] : data.rows
    console.log('Sending:', toSend)
    sendAndLog(req, res, toSend);
  }
}

/***************************************
 *      Universal Middleware           *
 * ************************************/

// Second, set CORS headers
app.use("/*", function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With"
  );
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST");
  return next();
});

/***************************************
 *              Misc                   *
 * ************************************/

// HOME GET TESTING
app.get("/test", function(req, res) {
  sendAndLog(req, res, { rows: ["hello", "world"] });
});

/***************************************
 *              Channels               *
 * ************************************/

// open channels count
app.get("/channels/open", async function(req, res) {
  await sendResFromQuery(
    `SELECT count(*)
      FROM cm_channels
      WHERE status = 'CS_OPEN'`,
    req,
    res
  );
});

app.get("/channels/inactive", async function(req, res) {
  await sendResFromQuery(
    `select date_trunc('day',"last_updated_on") as last_update, 
        count(*),
        sum("balance_token_hub") as collateral_locked
      from cm_channels 
      group by 1 
      order by 1 desc
      LIMIT 7;`,
    req,
    res,
    false,
  );
});

// average balances
app.get("/channels/averages", async function(req, res) {
  await sendResFromQuery(
    `WITH channel_count as(
      SELECT sum(balance_wei_user) as wei_total,
             sum(balance_token_user) as token_total,
             count(distinct id)
      FROM _cm_channels
      WHERE status = 'CS_OPEN'
    )
    SELECT wei_total/NULLIF(count,0) as avg_wei,
          token_total/NULLIF(count,0) as avg_tokens
    FROM channel_count`,
    req,
    res
  );
});

// channels that arent open details
app.get("/channels/notopen", async function(req, res) {
  await sendResFromQuery(
    `SELECT "user","status"
    FROM cm_channels
    WHERE "status" <> 'CS_OPEN'`,
    req,
    res
  );
});

// count of channels that arent open
app.get("/channels/notopen/count", async function(req, res) {
  await sendResFromQuery(
    `
    SELECT count(*)
    FROM cm_channels
    WHERE "status" <> 'CS_OPEN'
  `,
    req,
    res
  );
});

/***************************************
 *              PAYMENTS               *
 * ************************************/

// total
app.get("/payments/total", async function(req, res) {
  await sendResFromQuery(
    `
  SELECT count(*)
  FROM payments
  `,
    req,
    res
  );
});

// trailing 24hrs
app.get("/payments/trailing24", async function(req, res) {
  // SELECT count(*)
  // FROM _payments a
  // INNER JOIN _cm_channel_updates b
  // ON a.channel_update_id = b.id
  // WHERE b.created_on > now() - interval '1 day'
  await sendResFromQuery(
    `
    SELECT count(*)
    FROM payments 
    where created_on > now() - interval '1 day'
    `,
    req,
    res
  );
});

app.get("/payments/trailing24/pctchange", async function(req, res) {
  // SELECT count(*)
  // FROM _payments a
  // INNER JOIN _cm_channel_updates b
  // ON a.channel_update_id = b.id
  // WHERE b.created_on > now() - interval '1 day'
  await sendResFromQuery(
    `
    WITH t1 as(SELECT count(*) as ct
    FROM payments 
    where created_on > now() - interval '1 day'),
    t2 as (SELECT count(*) as ct
    FROM payments 
    where  created_on <  now() - interval '1 day' AND created_on > now() - interval '2 day' )
    SELECT CASE WHEN (b.ct = 0) THEN 0 ELSE ((a.ct- b.ct)*1.00/b.ct)*100 END as pctChange
    FROM t1 a, t2 b
    `,
    req,
    res
  );
});

// trailing 1week
app.get("/payments/trailingWeek", async function(req, res) {
  // SELECT count(*)
  // FROM _payments a
  // INNER JOIN _cm_channel_updates b
  // ON a.channel_update_id = b.id
  // WHERE b.created_on > now() - interval '1 day'
  await sendResFromQuery(
    `
    SELECT count(*)
    FROM payments 
    where created_on > now() - interval '1 week'
    `,
    req,
    res
  );
});

// date range
app.get("/payments/daterange/:startDate/:endDate", async function(req, res) {
  let { startDate, endDate } = req.params
  if (!startDate || !endDate) {
    console.log('Invalid request received. Params:', req.params)
    res.send(400)
  }

  const today = new Date().toISOString().split('T')

  if (startDate == endDate) {
    // this is within a 24 hour window
    startDate = startDate + ' ' + '00:00:00'
    if (endDate == today[0]) {
      endDate = endDate + ' ' + today[1].split('.')[0]
    }
  }

  await sendResFromQuery(
    `WITH payment_counts as(
      SELECT sum(amount_token) as token_sum,
            sum(amount_wei) as wei_sum,
             count(*)
      FROM payments a
      WHERE created_on::date BETWEEN '${startDate}'::date AND '${endDate}'::date)
      SELECT token_sum/NULLIF(count,0) as avg_token_payment, count
      FROM payment_counts
    `,
    req,
    res,
  );
});

app.get("/payments/trailingweek/pctchange", async function(req, res) {
  // SELECT count(*)
  // FROM _payments a
  // INNER JOIN _cm_channel_updates b
  // ON a.channel_update_id = b.id
  // WHERE b.created_on > now() - interval '1 day'
  await sendResFromQuery(
    `
    WITH t1 as(SELECT count(*) as ct
    FROM payments 
    where created_on > now() - interval '1 week'),
    t2 as (SELECT count(*) as ct
    FROM payments 
    where  created_on <  now() - interval '1 week' AND created_on > now() - interval '2 week' )
    SELECT CASE WHEN (b.ct = 0) THEN 0 ELSE ((a.ct- b.ct)*1.00/b.ct)*100 END as pctChange
    FROM t1 a, t2 b
    `,
    req,
    res
  );
});

// average
app.get("/payments/average/all", async function(req, res) {
  await sendResFromQuery(
    `
    WITH payment_counts as(
      SELECT sum(amount_token) as token_sum,
            sum(amount_wei) as wei_sum,
             count(*)
      FROM _payments)
    SELECT token_sum/NULLIF(count,0) as avg_token_payment,
            token_sum/NULLIF(count,0) as avg_wei_payment
    FROM payment_counts
`,
    req,
    res
  );
});

// average trailing 24
app.get("/payments/average/trailing24", async function(req, res) {
  await sendResFromQuery(
    `
    WITH payment_counts as(
      SELECT sum(amount_token) as token_sum,
            sum(amount_wei) as wei_sum,
             count(*)
      FROM payments a
      WHERE created_on > now() - interval '1 day')
    SELECT token_sum/NULLIF(count,0) as avg_token_payment,
            token_sum/NULLIF(count,0) as avg_wei_payment
    FROM payment_counts
`,
    req,
    res
  );
});

// average trailing 24
app.get("/payments/average/trailingweek", async function(req, res) {
  await sendResFromQuery(
    `
        WITH payment_counts as(
          SELECT sum(amount_token) as token_sum,
                sum(amount_wei) as wei_sum,
                 count(*)
          FROM payments a
          WHERE created_on > now() - interval '1 week')
        SELECT token_sum/NULLIF(count,0) as avg_token_payment,
                token_sum/NULLIF(count,0) as avg_wei_payment
        FROM payment_counts
    `,
    req,
    res
  );
});

// by ID
app.get("/payments/:purchaseId", async function(req, res) {
  const { purchaseId } = req.params
  if (!purchaseId) {
    console.log('Invalid request received. Params', req.params)
    res.send(400)
  }

  await sendResFromQuery(
    `SELECT *
        FROM _payments
        WHERE "purchase_id" = '${purchaseId}'::varchar
        LIMIT 1
    `,
    req,
    res,
  );
});

// frequency summary
app.get("/payments/frequency", async function(req, res) {
  await sendResFromQuery(
    `
        SELECT date_part('day', "created_on") as day, count(1)::int as count
        FROM _payments a
        INNER JOIN _cm_channel_updates b
        ON a."channel_update_id" = b."id"
        WHERE b."created_on" > now() - interval '1 day'
    `,
    req,
    res
  );
});

/***************************************
 *              Gas Cost               *
 * ************************************/

//trailing 24 hrs
app.get("/gascost/trailing24/:contractAddress", async function(req, res) {
  await sendResFromQuery(
    `
        SELECT sum(("gas" * "gas_price"))
        FROM onchain_transactions_raw
        WHERE "state" = 'confirmed'
            AND "from" = '${req.params.contractAddress}'
            AND confirmed_on > now() - interval '1 day'
    `,
    req,
    res
  );
});

//trailing week
app.get("/gascost/trailingweek/:contractAddress", async function(req, res) {
  await sendResFromQuery(
    `SELECT sum(("gas" * "gas_price"))
        FROM onchain_transactions_raw
        WHERE "state" = 'confirmed'
            AND "from" = '${req.params.contractAddress}'
            AND confirmed_on > now() - interval '1 week'
    `,
    req,
    res
  );
});

//trailing week
app.get("/gascost/all/:contractAddress", async function(req, res) {
  await sendResFromQuery(
    `
        SELECT sum(("gas" * "gas_price"))
        FROM onchain_transactions_raw
        WHERE "state" = 'confirmed'
        AND "from" = '${req.params.contractAddress}'
    `,
    req,
    res
  );
});

/***************************************
 *             Withdrawals             *
 * ************************************/

//withdrawal averages
app.get("/withdrawals/average", async function(req, res) {
  await sendResFromQuery(
    `
        SELECT sum(pending_withdrawal_wei_user)/NULLIF(count(*),0) as avg_withdrawal_wei,
              sum(pending_withdrawal_token_user)/NULLIF(count(*),0) as avg_withdrawal_token
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingWithdrawal'
            AND balance_wei_user = 0
    `,
    req,
    res
  );
});

// withdrawal count
app.get("/withdrawals/total", async function(req, res) {
  await sendResFromQuery(
    `SELECT count(*)
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingWithdrawal'
        AND balance_wei_user = 0
    `,
    req,
    res
  );
});

// withdrawal frequency
app.get("/withdrawals/frequency", async function(req, res) {
  await sendResFromQuery(
    `
        SELECT date_part('day', created_on) as day, count(*)::int
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingWithdrawal'
        AND balance_wei_user = 0
        GROUP BY 1
        ORDER BY 1
        LIMIT 7
    `,
    req,
    res,
    false
  );
});

/***************************************
 *         Collateralization           *
 * ************************************/

// hub collateralization frequency
// need to make this more efficient (add subquery, right now it's counting (*) twice for every single row)

app.get("/collateralization/ratio", async function(req, res) {
  await sendResFromQuery(
    `
    WITH t1 AS(
        SELECT sum("balance_token_user") as user_balances, 
                sum("balance_token_hub") as collateral 
        FROM public._cm_channels) 
        SELECT collateral/NULLIF(user_balances,0) as ratio FROM t1;
    `,
    req,
    res
  );
});

app.get("/collateralization/overcollateralized", async function(req, res) {
  await sendResFromQuery(
    `
        SELECT "user",
                "balance_token_hub" as collateral 
        FROM public._cm_channels
        ORDER BY 2 DESC
        LIMIT 15
    `,
    req,
    res,
    false
  );
});

/***************************************
 *              Deposits               *
 * ************************************/

//deposit averages
app.get("/deposits/average", async function(req, res) {
  await sendResFromQuery(
    `
        SELECT sum(pending_deposit_wei_user)/NULLIF(count(*),0) as avg_deposit_wei,
              sum(pending_deposit_token_user)/NULLIF(count(*),0) as avg_deposit_token
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingDeposit'
            AND (pending_deposit_wei_user <> 0 OR pending_deposit_token_user <> 0)
    `,
    req,
    res
  );
});

// deposit count
app.get("/deposits/total", async function(req, res) {
  await sendResFromQuery(
    `SELECT count(*)
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingDeposit'
            AND (pending_deposit_wei_user <> 0 OR pending_deposit_token_user <> 0)
    `,
    req,
    res
  );
});

// deposit frequency
app.get("/deposits/frequency", async function(req, res) {
  await sendResFromQuery(
    `
        SELECT date_part('day', created_on) as day, count(*)::int
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingDeposit'
            AND (pending_deposit_wei_user <> 0 OR pending_deposit_token_user <> 0)
        GROUP BY 1
        ORDER BY 1
        LIMIT 7
    `,
    req,
    res,
    false
  );
});

/***************************************
 *                Users                *
 * ************************************/

// user updates, last 10
app.get("/users/:user/:number", async function(req, res) {
  const { user, number } = req.params
  if (!user || !number) {
    console.log('Invalid request received. Params:', req.params)
    res.send(400)
  }

  await sendResFromQuery(
    `SELECT
      "user", "reason", "created_on", "balance_wei_hub","balance_wei_user","balance_token_hub","balance_token_user",
      "pending_deposit_wei_user","pending_deposit_token_hub","pending_deposit_wei_hub", "pending_deposit_token_user","pending_withdrawal_wei_hub",
      "pending_withdrawal_wei_user","pending_withdrawal_token_hub","pending_withdrawal_token_user"
    FROM cm_channel_updates
    WHERE "user" = '${user}'::text
    ORDER BY "created_on" DESC
    LIMIT ${parseInt(number)}`,
    req,
    res,
    false
  );
});

app.use(function(req, res) {
  console.log(`<= 404 Couldn't find ${req.url}`);
  res.status(404).send(`Couldn't find ${req.url}`);
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
