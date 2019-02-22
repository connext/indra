/* Replace with your SQL commands */
ALTER TABLE _payments ADD COLUMN secret text NULL;
ALTER TABLE _payments DROP CONSTRAINT _payments_check;
-- ALTER TABLE _payments ADD CONSTRAINT _payments_check 
--  ((((channel_update_id IS NULL) AND (thread_update_id IS NOT NULL)) OR ((channel_update_id IS NOT NULL) AND (thread_update_id IS NULL))))
ALTER TABLE _payments ADD CONSTRAINT _payments_check CHECK
  ((((channel_update_id IS NULL) AND (thread_update_id IS NOT NULL)) OR ((channel_update_id IS NOT NULL) AND (thread_update_id IS NULL)) OR ((channel_update_id IS NULL) AND (thread_update_id IS NULL) AND (secret IS NOT NULL))));


CREATE or replace VIEW payments AS
  SELECT p.id,
         up.created_on,
         up.contract,
         p.purchase_id,
         up."user" AS sender,
         p.recipient,
         p.amount_wei,
         p.amount_token,
         p.meta,
         'PT_CHANNEL'::text AS payment_type,
         up.recipient AS custodian_address,
         p.secret
  FROM (_payments p
    JOIN cm_channel_updates up ON ((up.id = p.channel_update_id)))
  UNION ALL
  SELECT p.id,
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
  FROM (_payments p
    JOIN cm_thread_updates up ON ((up.id = p.thread_update_id)))
  UNION ALL
  SELECT p.id,
         up.created_on,
         up.contract,
         p.purchase_id,
         up."user" AS sender,
         p.recipient,
         p.amount_wei,
         p.amount_token,
         p.meta,
         'PT_LINK'::text AS payment_type,
         up.recipient AS custodian_address,
         p.secret
  FROM  (_payments p
    JOIN cm_channel_updates up ON ((up.id = p.channel_update_id)));
