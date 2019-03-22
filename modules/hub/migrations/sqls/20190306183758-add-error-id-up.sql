/* Replace with your SQL commands */
-- channel status checks should also reflect
-- addition of enum type "CS_CHAINSAW_ERROR"
-- by adding chainsaw error event id to the _cm_channels
-- table, and checking this in the trigger
ALTER TABLE _cm_channels ADD COLUMN chainsaw_error_event_id BIGINT NULL;
ALTER TABLE _cm_channels DROP CONSTRAINT _cm_channels_check;
ALTER TABLE _cm_channels ADD CONSTRAINT _cm_channels_check CHECK (
  CASE status
  WHEN 'CS_CHANNEL_DISPUTE' THEN
      channel_dispute_id IS NOT NULL AND
      thread_dispute_event_id IS NULL
  WHEN 'CS_THREAD_DISPUTE' then
      channel_dispute_id IS NULL AND
      thread_dispute_event_id IS NOT NULL
  WHEN 'CS_CHAINSAW_ERROR' then
      chainsaw_error_event_id IS NOT NULL
  END
);