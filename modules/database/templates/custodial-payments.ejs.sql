create table custodial_payments (
    id bigserial primary key,
    payment_id bigint references _payments(id) unique not null,
    disbursement_id bigint references _cm_channel_updates(id) unique not null
);

create or replace function custodial_payments_pre_insert_update_trigger()
returns trigger language plpgsql as
$pgsql$
declare
    payment_recipient csw_eth_address;
    disbursement_user csw_eth_address;
begin
    payment_recipient := (select recipient from _payments where id = NEW.payment_id);
    disbursement_user := (select "user" from _cm_channel_updates where id = NEW.disbursement_id);
    if payment_recipient <> disbursement_user then
        raise exception 'payment_recipient = % is not the same as disbursement_user = %, (custodial_payment = %)',
            payment_recipient,
            disbursement_user,
            NEW;
    end if;

    return NEW;
end;
$pgsql$;

create trigger custodial_payments_pre_insert_update_trigger
before insert or update on custodial_payments
for each row execute procedure custodial_payments_pre_insert_update_trigger();