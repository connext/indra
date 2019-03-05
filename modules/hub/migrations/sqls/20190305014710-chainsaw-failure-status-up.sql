/* Replace with your SQL commands */
-- rename type fo change
ALTER TYPE cm_channel_status RENAME TO cm_channel_status__;
-- 2. create new type
CREATE TYPE cm_channel_status as enum (
  'CS_OPEN',
  'CS_CHANNEL_DISPUTE',
  'CS_THREAD_DISPUTE',
  'CS_CHAINSAW_ERROR'
);
-- drop dependent views: cm_channels, cm_channel_updates
-- drop default
-- ALTER TABLE _cm_channels ALTER COLUMN status DROP DEFAULT;
-- alter all you enum columns
ALTER TABLE _cm_channels
  ALTER COLUMN status TYPE cm_channel_status USING status::text::cm_channel_status;