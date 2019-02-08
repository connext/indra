drop view cm_channel_disputes;

create view cm_channel_disputes as (
    select
      _cm_channel_disputes.id,
      _cm_channel_disputes.channel_id,
      cm_channels.contract,
      cm_channels.hub,
      cm_channels."user",
      cm_channels.status as channel_status,
      _cm_channel_disputes.status,
      _cm_channel_disputes.started_on,
      _cm_channel_disputes.reason,
      _cm_channel_disputes.onchain_tx_id_start,
      _cm_channel_disputes.onchain_tx_id_empty,
      _cm_channel_disputes.start_event_id,
      _cm_channel_disputes.empty_event_id,
      _cm_channel_disputes.dispute_period_ends
    from _cm_channel_disputes
    inner join cm_channels on cm_channels.id = _cm_channel_disputes.channel_id
);