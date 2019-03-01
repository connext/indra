//SQL template string import
const SQL = require('sql-template-strings');

//express setup
var express = require('express');
var app = express();
var port = 9999;

//pg setup
const { Client } = require('pg')
const client = new Client({
    user: 'user',
    host: 'localhost',
    database: 'sc-hub',
    password: 'password',
    port: 5432,
  })


// CORS
app.all("/*", function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST");
    return next();
  });

let contractAddress = '0x2932b7a2355d6fecc4b5c0b6bd44cc31df247a2e';

queryDb = async (query) =>{
    let dbRes;
    try{
        //connect to DB client
        await client.connect()
        //run query
        dbRes = await client.query(query)
        console.log(dbRes.rows)
        await client.end()
    }catch(e){
        console.log(`Error: ${JSON.stringify(e.stack)}`)
    }
    return(dbRes.rows)
};

// HOME GET TESTING
app.get('/test', function (req, res) {
    let dbRes = ["hello","world"]
    res.send(dbRes)
  })

/*************************************** 
 *              Channels               *
 * ************************************/

// open channels count
app.get('/channels/open', async function (req, res) {
    let query = 
        `SELECT count(distinct id) 
          FROM _cm_channels
          WHERE status = 'CS_OPEN'`;
    let dbRes = await queryDb(query);
    res.send(dbRes)
  });

// average balances
  app.get('/channels/averages', async function (req, res) {
    let query = 
        `WITH channel_count as( 
                SELECT  sum(balance_wei_user) as wei_total,
                        sum(balance_token_user) as token_total,
                        count(distinct id) 
                FROM _cm_channels
                WHERE status = 'CS_OPEN')
        SELECT wei_total/count as avg_wei,
                token_total/count as avg_tokens
        FROM channel_count`;

    let dbRes = await queryDb(query);
    res.send(dbRes)
  })

/*************************************** 
 *              PAYMENTS               *
 * ************************************/

// total
app.get('/payments/total', function (req, res) {
    let query = 
        `SELECT count(*) 
          FROM _payments`;
    let dbRes = queryDb(query);
    res.send(dbRes)
  });

// trailing 24hrs
app.get('/payments/trailing24', function (req, res) {
    let query = 
        `SELECT count(*)
        FROM _payments a 
        INNER JOIN _cm_channel_updates b
        ON a.id = b.id
        WHERE b.created_on > now() - interval '1 day'`;
    let dbRes = queryDb(query);
    res.send(dbRes)
});

// average
app.get('/payments/average', function (req, res) {
    let query = 
        `
        WITH payment_counts as(
          SELECT sum(amount_token) as token_sum,
                sum(amount_wei) as wei_sum,
                 count(*)
          FROM _payments)
        SELECT token_sum/count as avg_token_payment,
                token_sum/count as avg_wei_payment
        FROM payment_counts`;
    let dbRes = queryDb(query);
    res.send(dbRes)
});

// by ID
app.get('/payments/:id', function (req, res) {
    let id = req.params.id;
    let query = 
        SQL`SELECT * 
        FROM _payments 
        WHERE purchase_id = ${id}
        LIMIT 10;`

    let dbRes = queryDb(query);
    res.send(dbRes)
});

/*************************************** 
 *              Gas Cost               *
 * ************************************/

//trailing 24 hrs
app.get('/gascost/trailing24', function (req, res) {
    let query = 
        SQL`SELECT sum(gas)
        FROM onchain_transactions_raw
        WHERE state = 'confirmed'
            AND "from" = ${contractAddress}
            AND confirmed_on > now() - interval '1 day'`;
    let dbRes = queryDb(query);
    res.send(dbRes)
});

//trailing week
app.get('/gascost/trailingweek', function (req, res) {
    let query = 
        SQL`SELECT sum(gas)
        FROM onchain_transactions_raw
        WHERE state = 'confirmed'
            AND "from" = ${contractAddress}
            AND confirmed_on > now() - interval '1 week'`;
    let dbRes = queryDb(query);
    res.send(dbRes)
});

/*************************************** 
 *             Withdrawals             *
 * ************************************/


//withdrawal averages
app.get('/withdrawals/average', function (req, res) {
    let query = 
        `
        SELECT sum(pending_withdrawal_wei_user)/count(*) as avg_withdrawal_wei,
              sum(pending_withdrawal_token_user)/count(*) as avg_withdrawal_token
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingWithdrawal'
            AND balance_wei_user = 0`;
    let dbRes = queryDb(query);
    res.send(dbRes)
});

// withdrawal frequency
app.get('/withdrawals/frequency', function (req, res) {
    let query = 
        `SELECT date_part('day', created_on) as day, count(*)
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingWithdrawal'
        AND balance_wei_user = 0
        GROUP BY 1`;
    let dbRes = queryDb(query);
    res.send(dbRes)
});


/*************************************** 
 *         Collateralization           *
 * ************************************/

// hub collateralization frequency
// need to make this more efficient (add subquery, right now it's counting (*) twice for every single row)
app.get('/collateralization/summary', function (req, res) {
    let query = 
        `SELECT date_part('day', created_on) as day, 
                count(*) as collateralizations,
                sum(pending_deposit_token_hub)/count(*) as avg_value
        FROM _cm_channel_updates
        WHERE reason = 'ProposePendingDeposit'
          AND pending_deposit_token_hub > 0
        GROUP BY 1`;
    let dbRes = queryDb(query);
    res.send(dbRes)
});


/*************************************** 
 *                Users                *
 * ************************************/

// user updates, last 10
app.get('/users/:id', function (req, res) {
    let id = req.params.id;
    let query = 
        SQL`SELECT * 
        FROM _cm_channel_updates 
        WHERE user = ${id}
        LIMIT 10;`
    let dbRes = queryDb(query);
    res.send(dbRes)
});


app.listen(port, () => console.log(`Listening on port ${port}!`))
