alter table ledger_channel_state_updates
add column created_at bigint;

update ledger_channel_state_updates
set created_at = retrievedat
from exchange_rates as er
where er.id = exchange_rate_id;

alter table ledger_channel_state_updates
alter column created_at
set not null;
