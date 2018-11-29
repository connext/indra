CREATE OR REPLACE VIEW payments AS
SELECT COALESCE(vcsu.channel_id, lcsu.channel_id) AS channel_id,
       COALESCE(vcsu.price_wei::numeric, lcsu.price_wei::numeric, p.price) AS amountwei,
       COALESCE(vcsu.price_erc20::numeric, lcsu.price_erc20::numeric) AS amounttoken,
       wei_to_fiat(COALESCE(vcsu.price_wei::numeric, lcsu.price_wei::numeric, p.price)::wei_amount, COALESCE(e.rate_usd, el.rate_usd, ep.rate_usd)) AS amountusd,
       COALESCE(v.party_a::character varying, lc.party_a::character varying, p.sender) AS sender,
       COALESCE(v.party_b::character varying, lc.party_i::character varying, m.receiver) AS receiver,
       COALESCE(e.rate_usd, el.rate_usd, ep.rate_usd) AS rate_usd,
       m.fields,
       m.type,
       m.purchase,
       COALESCE(m.vcupdatetoken::character varying, m.lcupdatetoken::character varying, m.paymenttoken) AS token,
       p.withdrawal_id,
       COALESCE(p."createdAt", vcsu.created_at) AS created_at
FROM payment_meta m
       LEFT JOIN virtual_channel_state_updates vcsu ON vcsu.id = m.vcupdatetoken
       LEFT JOIN virtual_channels v ON vcsu.channel_id::text = v.channel_id::text
       LEFT JOIN exchange_rates e ON vcsu.exchange_rate_id = e.id
       LEFT JOIN ledger_channel_state_updates lcsu ON lcsu.id = m.lcupdatetoken
       LEFT JOIN hub_ledger_channels lc ON lcsu.channel_id::text = lc.channel_id::text
       LEFT JOIN exchange_rates el ON lcsu.exchange_rate_id = el.id
       LEFT JOIN payment p ON p.token::text = m.paymenttoken::text
       LEFT JOIN exchange_rates ep ON p.exchange_rate_id = ep.id;
