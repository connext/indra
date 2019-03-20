const SQL = require('sql-template-strings');
const express = require('express');
const query = require('./db');

//express setup
const app = express();
const port = 9999;

//const contractAddress = '0x627306090abab3a6e1400e9345bc60c78a8bef57';

// Helper function: log each outgoing response before sending
const send = (req, res, data) => {
  if (typeof data == 'object') {
    data = JSON.stringify(data);
  }
  console.log(`=> ${req.method} ${req.url} => (200) Sent ${data.length} char${data.length === 1? '' : 's'} of data`)
  res.status(200).send(data);
}

/***************************************
 *      Universal Middleware           *
 * ************************************/

// Second, set CORS headers
app.use("/*", function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST");
    return next();
});

/***************************************
 *              Misc                   *
 * ************************************/

// HOME GET TESTING
app.get('/test', function (req, res) {
    send(req, res, {rows:["hello","world"]})
})

/***************************************
 *              Channels               *
 * ************************************/

// open channels count
app.get('/channels/open', async function (req, res) {
    send(req, res, await query(`
        SELECT count(distinct id)
        FROM _cm_channels
        WHERE status = 'CS_OPEN'
    `));
});

app.get('/channels/inactive', async function (req, res) {
    send(req, res, await query(`
    select date_trunc('day',"last_updated_on") as last_update, 
            count(*),
            sum("balance_token_hub") as collateral_locked
    from public._cm_channels 
    group by 1 
    order by 1 desc
    LIMIT 7;
    `));
});


// average balances
app.get('/channels/averages', async function (req, res) {
    send(req, res, await query(`
        WITH channel_count as(
            SELECT sum(balance_wei_user) as wei_total,
                   sum(balance_token_user) as token_total,
                   count(distinct id)
            FROM _cm_channels
            WHERE status = 'CS_OPEN'
        )
        SELECT wei_total/count as avg_wei,
               token_total/count as avg_tokens
        FROM channel_count
    `));
})

/***************************************
 *              PAYMENTS               *
 * ************************************/

// total
app.get('/payments/total', async function (req, res) {
    send(req, res, await query(`
        SELECT count(*)
        FROM payments
    `));
  });

// trailing 24hrs
app.get('/payments/trailing24', async function (req, res) {

    // SELECT count(*)
    // FROM _payments a
    // INNER JOIN _cm_channel_updates b
    // ON a.channel_update_id = b.id
    // WHERE b.created_on > now() - interval '1 day'
    send(req, res, await query(`
    SELECT count(*)
    FROM payments 
    where created_on > now() - interval '1 day'
    `));
});

app.get('/payments/trailing24/pctchange', async function (req, res) {

    // SELECT count(*)
    // FROM _payments a
    // INNER JOIN _cm_channel_updates b
    // ON a.channel_update_id = b.id
    // WHERE b.created_on > now() - interval '1 day'
    send(req, res, await query(`
    WITH t1 as(SELECT count(*) as ct
    FROM payments 
    where created_on > now() - interval '1 day'),
    t2 as (SELECT count(*) as ct
    FROM payments 
    where created_on BETWEEN (now() - interval '1 day') AND (now() - interval '2 day') )
    SELECT ((a.ct - b.ct)/b.ct)*100 as pctChange
    FROM t1 a, t2 b
    `));
});

// trailing 1week
app.get('/payments/trailingWeek', async function (req, res) {

    // SELECT count(*)
    // FROM _payments a
    // INNER JOIN _cm_channel_updates b
    // ON a.channel_update_id = b.id
    // WHERE b.created_on > now() - interval '1 day'
    send(req, res, await query(`
    SELECT count(*)
    FROM payments 
    where created_on > now() - interval '1 week'
    `));
});

// date range
app.get('/payments/daterange/:startDate/:endDate', async function (req, res) {
    send(req, res, await query(SQL`
    WITH payment_counts as(
        SELECT sum(amount_token) as token_sum,
              sum(amount_wei) as wei_sum,
               count(*)
        FROM payments a
        WHERE created_on BETWEEN ${req.params.startDate} AND ${req.params.endDate})
      SELECT token_sum/count as avg_token_payment,
              count
      FROM payment_counts
    `));
  });

app.get('/payments/trailingWeek/pctchange', async function (req, res) {

    // SELECT count(*)
    // FROM _payments a
    // INNER JOIN _cm_channel_updates b
    // ON a.channel_update_id = b.id
    // WHERE b.created_on > now() - interval '1 day'
    send(req, res, await query(`
    WITH t1 as(SELECT count(*) as ct
    FROM payments 
    where created_on > now() - interval '1 week'),
    t2 as (SELECT count(*) as ct
    FROM payments 
    where created_on BETWEEN (now() - interval '1 week') AND (now() - interval '2 week') )
    SELECT ((a.ct - b.ct)/b.ct)*100 as pctChange
    FROM t1 a, t2 b
    `));
});


// average
app.get('/payments/average/all', async function (req, res) {
    send(req, res, await query(`
        WITH payment_counts as(
          SELECT sum(amount_token) as token_sum,
                sum(amount_wei) as wei_sum,
                 count(*)
          FROM _payments)
        SELECT token_sum/count as avg_token_payment,
                token_sum/count as avg_wei_payment
        FROM payment_counts
    `));
});

// average trailing 24
app.get('/payments/average/trailing24', async function (req, res) {
    send(req, res, await query(`
        WITH payment_counts as(
          SELECT sum(amount_token) as token_sum,
                sum(amount_wei) as wei_sum,
                 count(*)
          FROM payments a
          WHERE created_on > now() - interval '1 day')
        SELECT token_sum/count as avg_token_payment,
                token_sum/count as avg_wei_payment
        FROM payment_counts
    `));
});

// average trailing 24
app.get('/payments/average/trailingweek', async function (req, res) {
    send(req, res, await query(`
        WITH payment_counts as(
          SELECT sum(amount_token) as token_sum,
                sum(amount_wei) as wei_sum,
                 count(*)
          FROM payments a
          WHERE created_on > now() - interval '1 week')
        SELECT token_sum/count as avg_token_payment,
                token_sum/count as avg_wei_payment
        FROM payment_counts
    `));
});


// by ID
app.get('/payments/:id', async function (req, res) {
    send(req, res, await query(SQL`SELECT *
        FROM _payments
        WHERE "purchase_id" = ${req.params.id}
        LIMIT 10
    `));
});

// frequency summary
app.get('/payments/frequency', async function (req, res) {
    send(req, res, await query(`
        SELECT date_part('day', "created_on") as day, count(1)::int as count
        FROM _payments a
        INNER JOIN _cm_channel_updates b
        ON a."channel_update_id" = b."id"
        WHERE b."created_on" > now() - interval '1 day'
    `));
});

/***************************************
 *              Gas Cost               *
 * ************************************/

//trailing 24 hrs
app.get('/gascost/trailing24/:contractAddress', async function (req, res) {
    send(req, res, await query(SQL`
        SELECT sum(("gas" * "gas_price"))
        FROM onchain_transactions_raw
        WHERE "state" = 'confirmed'
            AND "from" = ${req.params.contractAddress}
            AND confirmed_on > now() - interval '1 day'
    `));
});

//trailing week
app.get('/gascost/trailingweek/:contractAddress', async function (req, res) {
    send(req, res, await query(SQL`SELECT sum(("gas" * "gas_price"))
        FROM onchain_transactions_raw
        WHERE "state" = 'confirmed'
            AND "from" = ${req.params.contractAddress}
            AND confirmed_on > now() - interval '1 week'
    `));
});

//trailing week
app.get('/gascost/all/:contractAddress', async function (req, res) {
    send(req, res, await query(SQL`
        SELECT sum(("gas" * "gas_price"))
        FROM onchain_transactions_raw
        WHERE "state" = 'confirmed'
        AND "from" = ${req.params.contractAddress}
    `));
});

/***************************************
 *             Withdrawals             *
 * ************************************/


//withdrawal averages
app.get('/withdrawals/average', async function (req, res) {
    send(req, res, await query(`
        SELECT sum(pending_withdrawal_wei_user)/count(*) as avg_withdrawal_wei,
              sum(pending_withdrawal_token_user)/count(*) as avg_withdrawal_token
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingWithdrawal'
            AND balance_wei_user = 0
    `));
});

// withdrawal count
app.get('/withdrawals/total', async function (req, res) {
    send(req, res, await query(`SELECT count(*)
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingWithdrawal'
        AND balance_wei_user = 0
    `));
});

// withdrawal frequency
app.get('/withdrawals/frequency', async function (req, res) {
    send(req, res, await query(`
        SELECT date_part('day', created_on) as day, count(*)::int
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingWithdrawal'
        AND balance_wei_user = 0
        GROUP BY 1
        ORDER BY 1
        LIMIT 7
    `));
});


/***************************************
 *         Collateralization           *
 * ************************************/

// hub collateralization frequency
// need to make this more efficient (add subquery, right now it's counting (*) twice for every single row)

app.get('/collateralization/ratio', async function (req, res) {
    send(req, res, await query(`
    WITH t1 AS(
        SELECT sum("balance_token_user") as user_balances, 
                sum("balance_token_hub") as collateral 
        FROM public._cm_channels) 
        SELECT collateral/user_balances as ratio FROM t1;
    `));
});

app.get('/collateralization/overcollateralized', async function (req, res) {
    send(req, res, await query(`
        SELECT "user",
                "balance_token_hub" as collateral 
        FROM public._cm_channels
        ORDER BY 2 DESC
        LIMIT 15
    `));
});


/***************************************
 *              Deposits               *
 * ************************************/

//withdrawal averages
app.get('/deposits/average', async function (req, res) {
    send(req, res, await query(`
        SELECT sum(pending_deposit_wei_user)/count(*) as avg_deposit_wei,
              sum(pending_deposit_token_user)/count(*) as avg_deposit_token
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingDeposit'
            AND (pending_deposit_wei_user <> 0 OR pending_deposit_token_user <> 0)
    `));
});

// withdrawal count
app.get('/deposits/total', async function (req, res) {
    send(req, res, await query(`SELECT count(*)
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingDeposit'
            AND (pending_deposit_wei_user <> 0 OR pending_deposit_token_user <> 0)
    `));
});

// withdrawal frequency
app.get('/deposits/frequency', async function (req, res) {
    send(req, res, await query(`
        SELECT date_part('day', created_on) as day, count(*)::int
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingDeposit'
            AND (pending_deposit_wei_user <> 0 OR pending_deposit_token_user <> 0)
        GROUP BY 1
        ORDER BY 1
        LIMIT 7
    `));
});


/***************************************
 *                Users                *
 * ************************************/

// user updates, last 10
app.get('/users/:id/:number', async function (req, res) {
    send(req, res, await query(SQL`
        SELECT "user", "reason", "created_on", "balance_wei_hub","balance_wei_user","balance_token_hub","balance_token_user",
        "pending_deposit_wei_user","pending_deposit_token_hub","pending_deposit_wei_hub", "pending_deposit_token_user","pending_withdrawal_wei_hub",
        "pending_withdrawal_wei_user","pending_withdrawal_token_hub","pending_withdrawal_token_user"
        FROM _cm_channel_updates
        WHERE "user" = ${req.params.id}
        ORDER BY "created_on" DESC
        LIMIT ${req.params.number}
    `));
});

app.use(function (req, res) {
    console.log(`<= 404 Couldn't find ${req.url}`)
    res.status(404).send(`Couldn't find ${req.url}`)
})

app.listen(port, () => console.log(`Listening on port ${port}!`))
