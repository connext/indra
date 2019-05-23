alter table payments_optimistic add unique (payment_id);
alter table payments_optimistic add unique (channel_update_id);
alter table payments_optimistic add unique (thread_update_id);
alter table payments_optimistic add unique (redemption_id);