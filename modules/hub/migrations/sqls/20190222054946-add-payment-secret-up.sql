/* Replace with your SQL commands */
ALTER TABLE _payments
  ADD COLUMN secret text NULL;
ALTER TABLE _payments ADD CONSTRAINT _unique_secret UNIQUE (secret);

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

  -- TODO: create the payments_thread table, as documented in ./20190130223123-custodial-payments-up.sql
  -- union all

  -- select
  --   p.id,
  --   up.created_on,
  --   up.contract,

  --   p.purchase_id,
  --   up.sender,
  --   p.recipient,

  --   p.amount_wei,
  --   p.amount_token,
  --   p.meta,

  --   'thread' AS payment_type
  -- from _payments p
  -- left join cm_thread_updates up on up.id = p.thread_update_id

  -- TODO: #122: add link payments here

);


-- TODO: this probably needs to be removed as part of #122
-- CREATE OR REPLACE FUNCTION custodial_payments_pre_insert_update_trigger() RETURNS trigger
-- LANGUAGE plpgsql
-- AS $$
-- declare
--   payment_recipient csw_eth_address;
--   disbursement_user csw_eth_address;
-- begin
--   payment_recipient := (select recipient from _payments where id = NEW.payment_id);
--   disbursement_user := (select "user" from _cm_channel_updates where id = NEW.disbursement_id);
--   if payment_recipient <> disbursement_user AND payment_recipient <> '0x0000000000000000000000000000000000000000' then
--     raise exception 'payment_recipient = % is not the same as disbursement_user = %, (custodial_payment = %)',
--     payment_recipient,
--     disbursement_user,
--     NEW;
--   end if;
-- 
--   return NEW;
-- end;
-- $$;
