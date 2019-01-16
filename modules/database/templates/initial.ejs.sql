create extension if not exists citext;

CREATE DOMAIN csw_eth_address as citext
CHECK ( value ~* '^0x[a-f0-9]{40}$' );

CREATE DOMAIN csw_sha3_hash AS citext
CHECK ( value ~* '^0x[a-f0-9]{64}$' );

CREATE DOMAIN eth_signature AS VARCHAR(132)
CHECK ( value ~* '^0x[a-f0-9]{130}$' );

CREATE DOMAIN token_amount AS NUMERIC(78,0);

CREATE DOMAIN wei_amount AS NUMERIC(78,0);

CREATE TABLE exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    retrievedat BIGINT,
    base VARCHAR,
    rate_usd NUMERIC(78, 2)
);

CREATE TABLE chainsaw_poll_events (
    block_number BIGINT NOT NULL,
    polled_at BIGINT NOT NULL,
    contract csw_eth_address NOT NULL,
    poll_type varchar not null default 'FETCH_EVENTS',
    tx_idx integer
);

alter table chainsaw_poll_events
add constraint chainsaw_poll_events_block_number_tx_id_unique
unique (block_number, tx_idx);

CREATE TABLE gas_estimates (
    id BIGSERIAL PRIMARY KEY,
    retrieved_at BIGINT,

    speed DOUBLE PRECISION,
    block_num BIGINT UNIQUE,
    block_time DOUBLE PRECISION,

    fastest DOUBLE PRECISION,
    fastest_wait DOUBLE PRECISION,

    fast DOUBLE PRECISION,
    fast_wait DOUBLE PRECISION,

    average DOUBLE PRECISION,
    avg_wait DOUBLE PRECISION,

    safe_low DOUBLE PRECISION,
    safe_low_wait DOUBLE PRECISION
);