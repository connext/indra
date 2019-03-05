-- /* Replace with your SQL commands */
-- See the comments in the source
-- this migration uses the sql `ALTER TYPE cm_channel_status ADD VALUE 
-- 'CS_CHAINSAW_ERROR';`


-- this migration is performed OUTSIDE of a transaction. these are for
-- additive changes in the enum type, which by default, are operations
-- that cannot be performed within a transaction.