/* Replace with your SQL commands */
CREATE OR REPLACE function cm_channels_check_update_trigger()
    returns trigger language plpgsql as
    $pgsql$
    declare
      dispute_id bigint;
    begin
        -- Check unilateral start exit and change status
        dispute_id := (
            select id from cm_channel_disputes
            where
                channel_id = NEW.id and
                status in ('CD_PENDING', 'CD_IN_DISPUTE_PERIOD')
        );

        if NEW.channel_dispute_id is not null then
            NEW.status := 'CS_CHANNEL_DISPUTE';

            if (dispute_id) is null then
                raise exception 'Channel has invalid channel dispute status, dispute status: % (NEW: %)',
                (select status from cm_channel_disputes where id = NEW.channel_dispute_id),
                NEW;
            end if;
        else
            -- if a chainsaw error event id exists, then
            -- the channel must have a chainsaw error status
            if NEW.chainsaw_error_event_id is not null then
              NEW.status := 'CS_CHAINSAW_ERROR';
            else
              NEW.status := 'CS_OPEN';
            end if;
            
            -- channel should be marked in dispute status
            -- regardless of chainsaw error
            if (dispute_id) is not null then
              raise exception 'Channel has invalid channel dispute status, dispute status: % (NEW: %)',
              (select status from cm_channel_disputes where id = NEW.channel_dispute_id),
              NEW;
            end if;
        end if;

        -- Check that the dispute status is reasonable
        if not (
            coalesce(
                NEW.channel_dispute_id::text,
                NEW.thread_dispute_event_id::text,
                NEW.thread_dispute_ends_on::text,
                NEW.thread_dispute_originator::text
            ) is null or

            (
                NEW.channel_dispute_id is not null
            ) or

            (
                NEW.thread_dispute_event_id is not null and
                NEW.thread_dispute_ends_on is not null and
                NEW.thread_dispute_originator is not null
            )
        ) then
            raise exception 'Channel has invalid channel/thread dispute status: %', NEW;
        end if;
        -- TODO: Probably more checks
        return NEW;

    end;
    $pgsql$;