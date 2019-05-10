
/* Simple payment profile with min collateral and collateral target */
create table payment_profiles (
	id bigserial primary key,
  minimum_maintained_collateral_wei wei_amount not null default '0',
  minimum_maintained_collateral_token wei_amount not null default '0',
  amount_to_collateralize_wei wei_amount not null default '0',
  amount_to_collateralize_token wei_amount not null default '0'
);

/* Add payment profile id to the channels column */
alter table _cm_channels add column payment_profile_id bigint null;
alter table _cm_channels add constraint payment_profile_id_fk foreign key (payment_profile_id) references payment_profiles(id);

/* Update the channels view */
create or replace view cm_channels as (select * from _cm_channels);