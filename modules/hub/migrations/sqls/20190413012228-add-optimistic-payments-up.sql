/* Replace with your SQL commands */
/* TODO: replace enum? pain to migrate...*/
create type PAYMENTS_OPTIMISTIC_STATUS as enum (
  'new',
  'completed',
  'custodial',
  'failed'
);

/* add optimistic payments table */
create table payments_optimistic (
  id bigint primary key,
  payment_id bigint not null references _payments,
  channel_update_id bigint null references _cm_channel_updates,
  thread_update_id bigint null references _cm_thread_updates,
  redemption_id bigint null references _cm_channel_updates,
  custodial_id bigint null references payments_channel_custodial,
  status PAYMENTS_OPTIMISTIC_STATUS not null default 'new',
  created_on timestamp with time zone not null default now()
);

/* add trigger on insert into table to check status validity */
create or replace function payments_optimistic_post_insert_update_trigger()
returns trigger language plpgsql as
$pgsql$
declare
  payment payments_optimistic;
begin
  select * from payments_optimistic
  where id = NEW.id
  into payment;

  -- set the status based on the update set
  if payment.custodial_id is not null then 
    NEW.status = 'custodial';
  end if;

  if payment.channel_update_id is not null then
    -- TODO: am i actually avoiding race conditions here
    if payment.redemption_id is not null then
      NEW.status = 'completed';
    end if;
  end if;

  if payment.thread_update_id is not null then
    NEW.status = 'completed';
  end if;

  if payment.created_on < now() - interval '30 seconds' then
    NEW.status = 'failed';
  end if;

  -- otherwise, should be default status, 'new'
  return NEW;

end;
$pgsql$;

create trigger payments_optimistic_post_insert_trigger
after insert or update on payments_optimistic
for each row execute procedure payments_optimistic_post_insert_update_trigger();

/* add optimistic payments to view */
create or replace view payments as (
  select
    p.id,
    up.created_on,
    up.contract,

    purchase_id,
    up."user" as sender,
    p.recipient,

    amount_wei,
    amount_token,
    meta,

    'channel-instant' as payment_type
  from _payments as p
  inner join payments_channel_instant as ci on ci.payment_id = p.id
  left join cm_channel_updates as up on up.id = ci.update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    purchase_id,
    up."user" as sender,
    p.recipient,

    amount_wei,
    amount_token,
    meta,

    'hub-direct' as payment_type
  from _payments as p
  inner join payments_hub_direct as ph on ph.payment_id = p.id
  left join cm_channel_updates as up on up.id = ph.update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    purchase_id,
    up."user" as sender,
    p.recipient,

    amount_wei,
    amount_token,
    meta,

    'channel-custodial' as payment_type
  from _payments as p
  inner join payments_channel_custodial as cc on cc.payment_id = p.id
  left join cm_channel_updates as up on up.id = cc.update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    p.purchase_id,
    up.sender,
    p.recipient,

    p.amount_wei,
    p.amount_token,
    p.meta,

    'thread' AS payment_type
  from _payments p
  inner join payments_thread as pt on pt.payment_id = p.id
  left join cm_thread_updates up on up.id = pt.update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    p.purchase_id,
    up."user" as sender,
    p.recipient,

    p.amount_wei,
    p.amount_token,
    p.meta,

    'link' AS payment_type
  from _payments p
  inner join payments_link as pl on pl.payment_id = p.id
  left join cm_channel_updates up on up.id = pl.update_id

  union all

  select
    p.id,
    up.created_on,
    up.contract,

    p.purchase_id,
    up."user" as sender,
    p.recipient,

    p.amount_wei,
    p.amount_token,
    p.meta,

    'optimistic' AS payment_type
  from _payments p
  inner join payments_optimistic as po on po.payment_id = p.id
  left join cm_channel_updates up on up.id = po.channel_update_id
);

/* trigger should sanity check the status */
