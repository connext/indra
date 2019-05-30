/* Replace with your SQL commands */
create table emails (
  id bigserial primary key,
  mailgun_id text unique not null,
  address csw_eth_address not null,
  subject text,
  body text
);