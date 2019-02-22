/* Replace with your SQL commands */
ALTER TABLE _payments ADD COLUMN secret text NULL;
ALTER TABLE _payments DROP CONSTRAINT _payments_check;
DROP VIEW payments;
CREATE VIEW payments AS
  SELECT p.id,
         up.created_on,
         up.contract,
         p.purchase_id,
         up."user" AS sender,
         p.recipient,
         p.secret,
         p.amount_wei,
         p.amount_token,
         p.meta,
         'PT_CHANNEL'::text AS payment_type,
         up.recipient AS custodian_address
  FROM (_payments p
    JOIN cm_channel_updates up ON ((up.id = p.channel_update_id)))
  UNION ALL
  SELECT p.id,
         up.created_on,
         up.contract,
         p.purchase_id,
         up.sender,
         p.recipient,
         p.secret,
         p.amount_wei,
         p.amount_token,
         p.meta,
         'PT_THREAD'::text AS payment_type,
         NULL::citext AS custodian_address
  FROM (_payments p
    JOIN cm_thread_updates up ON ((up.id = p.thread_update_id)))
  UNION ALL
  SELECT p.id,
         up.created_on,
         up.contract,
         p.purchase_id,
         up."user" AS sender,
         p.recipient,
         p.secret,
         p.amount_wei,
         p.amount_token,
         p.meta,
         'PT_LINK'::text AS payment_type,
         up.recipient AS custodian_address
  FROM  (_payments p
    JOIN cm_channel_updates up ON ((up.id = p.channel_update_id)));
