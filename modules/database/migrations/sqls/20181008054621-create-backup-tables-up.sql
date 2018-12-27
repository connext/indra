-- NOTE: The following tables are explicitly _not_ migrated:
-- 'migrations': because it needs to keep track of this migration
-- 'feature_flags': unnecessary
-- 'exchange_rates': unnecessary
-- 'disbursements': unnecessary
-- 'gas_estimates': unnecessary
-- 'global_settings': unnecessary
-- name as 'z__backup__' for clarity and so backup tables appear at the bottom of the list in visual SQL tools
CREATE TABLE z__backup__applied_wallet_migrations AS TABLE applied_wallet_migrations;
CREATE TABLE z__backup__available_wallet_migrations AS TABLE available_wallet_migrations;
CREATE TABLE z__backup__chainsaw_channel_events AS TABLE chainsaw_channel_events;
CREATE TABLE z__backup__chainsaw_channels AS TABLE chainsaw_channels;
CREATE TABLE z__backup__chainsaw_channels_deposits AS TABLE chainsaw_channels_deposits;
CREATE TABLE z__backup__chainsaw_ledger_channels AS TABLE chainsaw_ledger_channels;
CREATE TABLE z__backup__chainsaw_ledger_channels_deposits AS TABLE chainsaw_ledger_channels_deposits;
CREATE TABLE z__backup__chainsaw_poll_events AS TABLE chainsaw_poll_events;
CREATE TABLE z__backup__channel AS TABLE channel;
CREATE TABLE z__backup__channel_claims AS TABLE channel_claims;
CREATE TABLE z__backup__disbursements AS TABLE disbursements;
CREATE TABLE z__backup__ledger_channel_state_updates AS TABLE ledger_channel_state_updates;
CREATE TABLE z__backup__payment AS TABLE payment;
CREATE TABLE z__backup__payment_meta AS TABLE payment_meta;
CREATE TABLE z__backup__token AS TABLE token;
CREATE TABLE z__backup__virtual_channel_state_updates AS TABLE virtual_channel_state_updates;
CREATE TABLE z__backup__virtual_channels AS TABLE virtual_channels;
CREATE TABLE z__backup__withdrawals AS TABLE withdrawals;

TRUNCATE applied_wallet_migrations CASCADE;
TRUNCATE available_wallet_migrations CASCADE;
TRUNCATE chainsaw_channel_events CASCADE;
TRUNCATE chainsaw_channels CASCADE;
TRUNCATE chainsaw_channels_deposits CASCADE;
TRUNCATE chainsaw_ledger_channels CASCADE;
TRUNCATE chainsaw_ledger_channels_deposits CASCADE;
TRUNCATE chainsaw_poll_events CASCADE;
TRUNCATE channel CASCADE;
TRUNCATE channel_claims CASCADE;
TRUNCATE disbursements CASCADE;
TRUNCATE ledger_channel_state_updates CASCADE;
TRUNCATE payment CASCADE;
TRUNCATE payment_meta CASCADE;
TRUNCATE token CASCADE;
TRUNCATE virtual_channel_state_updates CASCADE;
TRUNCATE virtual_channels CASCADE;
TRUNCATE withdrawals CASCADE;
