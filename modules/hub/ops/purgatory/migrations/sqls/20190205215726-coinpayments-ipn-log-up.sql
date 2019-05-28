create table coinpayments_ipn_log (
    id bigserial primary key,
    created_on timestamp with time zone not null default now(),
    "user" csw_eth_address,
    ipn_id text not null,
    status integer not null,
    status_text text not null,
    address text not null,
    data jsonb not null
);

create index coinpayments_ipn_log_ipn_id
on coinpayments_ipn_log (ipn_id);
