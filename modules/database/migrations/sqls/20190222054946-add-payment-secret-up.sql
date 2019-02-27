/* Replace with your SQL commands */
ALTER TABLE _payments
  ADD COLUMN secret text NULL;
ALTER TABLE _payments ADD CONSTRAINT _unique_secret UNIQUE (secret);

CREATE OR REPLACE VIEW payments AS
SELECT
  p.id,
  up.created_on,
  up.contract,
  p.purchase_id,
  up. "user" AS sender,
  p.recipient,
  p.amount_wei,
  p.amount_token,
  p.meta,
  CASE WHEN p.secret IS NOT NULL
  	   THEN 'PT_LINK'::text 
  	   ELSE 'PT_CHANNEL'::text
  	   END AS payment_type,
  up.recipient AS custodian_address,
  p.secret
FROM (
  _payments p
  JOIN cm_channel_updates up ON ((up.id = p.channel_update_id)))
UNION ALL
SELECT
  p.id,
  up.created_on,
  up.contract,
  p.purchase_id,
  up.sender,
  p.recipient,
  p.amount_wei,
  p.amount_token,
  p.meta,
  'PT_THREAD'::text AS payment_type,
  NULL::citext AS custodian_address,
  p.secret
FROM (
  _payments p
  JOIN cm_thread_updates up ON ((up.id = p.thread_update_id)));


CREATE OR REPLACE FUNCTION custodial_payments_pre_insert_update_trigger() RETURNS trigger
LANGUAGE plpgsql
AS $$
declare
  payment_recipient csw_eth_address;
  disbursement_user csw_eth_address;
begin
  payment_recipient := (select recipient from _payments where id = NEW.payment_id);
  disbursement_user := (select "user" from _cm_channel_updates where id = NEW.disbursement_id);
  if payment_recipient <> disbursement_user AND payment_recipient <> '0x0000000000000000000000000000000000000000' then
    raise exception 'payment_recipient = % is not the same as disbursement_user = %, (custodial_payment = %)',
    payment_recipient,
    disbursement_user,
    NEW;
  end if;

  return NEW;
end;
$$;