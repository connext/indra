create type onchain_transaction_state as enum (
    'new',
    'submitted',
    'confirmed',
    'failed'
);

create table onchain_transactions_raw (
  id bigserial primary key,
  logical_id bigint not null,
  state onchain_transaction_state not null default 'new',

  "from" csw_eth_address not null,
  "to" csw_eth_address not null,
  value wei_amount not null,
  gas bigint not null,
  gas_price bigint not null,
  data text not null,
  nonce bigint not null,

  -- TODO: REB-61
  -- signature jsonb not null check (
  --   json_not_null(signature, 'r', 'hex') is not null and
  --   json_not_null(signature, 's', 'hex') is not null and
  --   json_not_null(signature, 'v', 'uint')::integer is not null
  -- ),
  --hash csw_sha3_hash not null unique,
  signature jsonb,
  hash csw_sha3_hash unique,

  meta jsonb not null, -- includes reason, contract, method, args, etc

  created_on timestamp with time zone not null default now(),
  submitted_on timestamp with time zone,

  confirmed_on timestamp with time zone,
  block_num integer,
  block_hash csw_sha3_hash,
  transaction_index integer,

  failed_on timestamp with time zone,
  failed_reason text
);

-- The sequence that will be used for the logical IDs
create sequence onchain_transactions_raw_logical_id_seq
start with 1;

alter sequence onchain_transactions_raw_id_seq
start with 10000000;

-- For now, enforce the constraint that there can only be one non-failed
-- onchain transaction for each logical ID. This is not, strictly speaking, true
-- because in the future we may want to implement a system which tries to submit
-- with incrementally higher gas prices... but for now this should be good.
create unique index onchain_transactions_raw_logical_id_unique
on onchain_transactions_raw (logical_id)
where (state <> 'failed');
