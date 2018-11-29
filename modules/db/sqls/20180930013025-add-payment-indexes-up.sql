create index payment_sender on payment (sender);
create index payment_receiver on payment (receiver);

create index virtual_channel_state_updates_channel_id on virtual_channel_state_updates (channel_id);

create index virtual_channels_channel_id on virtual_channels (channel_id);
create index virtual_channels_party_a on virtual_channels (party_a);
create index virtual_channels_party_b on virtual_channels (party_b);
create index virtual_channels_party_i on virtual_channels (party_i);
