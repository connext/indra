--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.3
-- Dumped by pg_dump version 9.6.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: hstore; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS hstore WITH SCHEMA public;


--
-- Name: EXTENSION hstore; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION hstore IS 'data type for storing sets of (key, value) pairs';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


SET search_path = public, pg_catalog;

--
-- Name: currency_name; Type: TYPE; Schema: public; Owner: wolever
--

CREATE TYPE currency_name AS ENUM (
    'ETH',
    'BOOTY',
    'FINNEY'
);


ALTER TYPE currency_name OWNER TO wolever;

--
-- Name: eth_address; Type: DOMAIN; Schema: public; Owner: wolever
--

CREATE DOMAIN eth_address AS citext
	CONSTRAINT eth_address_check CHECK (((length((VALUE)::text) = 42) AND (VALUE ~~ '0x%'::citext)));


ALTER DOMAIN eth_address OWNER TO wolever;

--
-- Name: eth_amount; Type: DOMAIN; Schema: public; Owner: wolever
--

CREATE DOMAIN eth_amount AS numeric(1000,18);


ALTER DOMAIN eth_amount OWNER TO wolever;

--
-- Name: clip(anyelement, anyelement, anyelement, text); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION clip(val anyelement, min anyelement, max anyelement, coalesce_to text DEFAULT NULL::text) RETURNS anyelement
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  if coalesce_to is not null and coalesce_to <> 'min' and coalesce_to <> 'max' then
    raise exception 'coalesce_to must be "min", "max", or NULL; not: %', coalesce_to;
  end if;

  if val is null then
    return COALESCE(val, case coalesce_to when 'min' then min when 'max' then max else null end);
  end if;

  return case
    when val < min then min
    when val > max then max
    else val
  end;
END
$$;


ALTER FUNCTION public.clip(val anyelement, min anyelement, max anyelement, coalesce_to text) OWNER TO wolever;

--
-- Name: to_integer(text, integer); Type: FUNCTION; Schema: public; Owner: wolever
--

CREATE FUNCTION to_integer(value text, dflt integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
begin
    if value is null then
        return null;
    end if;

    return value::integer;
exception
    when invalid_text_representation then
        return dflt;
end;
$$;


ALTER FUNCTION public.to_integer(value text, dflt integer) OWNER TO wolever;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: announcement_views; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE announcement_views (
    id integer NOT NULL,
    user_or_anon_id character varying(20) NOT NULL,
    announcement_name character varying(40)
);


ALTER TABLE announcement_views OWNER TO wolever;

--
-- Name: announcement_views_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE announcement_views_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE announcement_views_id_seq OWNER TO wolever;

--
-- Name: announcement_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE announcement_views_id_seq OWNED BY announcement_views.id;


--
-- Name: bad_message_log; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE bad_message_log (
    id integer NOT NULL,
    user_or_anon_id character varying(20),
    camshow_id integer NOT NULL,
    reported_by integer NOT NULL,
    report_type character varying(255) NOT NULL,
    history_item jsonb,
    "createdOn" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedOn" timestamp with time zone
);


ALTER TABLE bad_message_log OWNER TO wolever;

--
-- Name: bad_message_log_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE bad_message_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE bad_message_log_id_seq OWNER TO wolever;

--
-- Name: bad_message_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE bad_message_log_id_seq OWNED BY bad_message_log.id;


--
-- Name: camshow_events; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE camshow_events (
    id integer NOT NULL,
    sender_or_anon_id character varying(64) NOT NULL,
    camshow_id integer,
    name character varying(255),
    data jsonb DEFAULT '{}'::jsonb,
    "createdOn" timestamp with time zone NOT NULL,
    "updatedOn" timestamp with time zone NOT NULL,
    "deletedOn" timestamp with time zone
);


ALTER TABLE camshow_events OWNER TO wolever;

--
-- Name: camshow_events_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE camshow_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE camshow_events_id_seq OWNER TO wolever;

--
-- Name: camshow_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE camshow_events_id_seq OWNED BY camshow_events.id;


--
-- Name: camshow_membership; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE camshow_membership (
    id integer NOT NULL,
    performer_id integer NOT NULL,
    member_or_anon_id character varying(20) NOT NULL,
    status character varying(255) NOT NULL,
    "createdOn" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedOn" timestamp with time zone DEFAULT now() NOT NULL,
    "deletedOn" timestamp with time zone
);


ALTER TABLE camshow_membership OWNER TO wolever;

--
-- Name: camshow_membership_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE camshow_membership_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE camshow_membership_id_seq OWNER TO wolever;

--
-- Name: camshow_membership_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE camshow_membership_id_seq OWNED BY camshow_membership.id;


--
-- Name: camshows; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE camshows (
    id integer NOT NULL,
    performer_id integer,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    state jsonb DEFAULT '{}'::jsonb,
    feed_id character varying(255),
    tip_total_eth eth_amount DEFAULT 0,
    tip_highest_id integer,
    tip_highest_eth eth_amount DEFAULT 0,
    tip_latest_id integer,
    tip_latest_eth eth_amount DEFAULT 0,
    "createdOn" timestamp with time zone NOT NULL,
    "updatedOn" timestamp with time zone NOT NULL,
    "deletedOn" timestamp with time zone,
    was_promoted boolean,
    base_currency currency_name
);


ALTER TABLE camshows OWNER TO wolever;

--
-- Name: camshows_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE camshows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE camshows_id_seq OWNER TO wolever;

--
-- Name: camshows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE camshows_id_seq OWNED BY camshows.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE chat_messages (
    id integer NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    user_id integer,
    anon_user_id character varying(16),
    camshow_id integer NOT NULL,
    text character varying(255) NOT NULL,
    was_filtered boolean,
    CONSTRAINT chat_messages_check_one_user_id_is_set CHECK (((user_id IS NOT NULL) OR (anon_user_id IS NOT NULL)))
);


ALTER TABLE chat_messages OWNER TO wolever;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE chat_messages_id_seq OWNER TO wolever;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE chat_messages_id_seq OWNED BY chat_messages.id;


--
-- Name: metrics; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE metrics (
    id integer NOT NULL,
    ts timestamp with time zone NOT NULL,
    sender_id character varying(255) NOT NULL,
    name character varying(128) NOT NULL,
    data jsonb NOT NULL,
    server_time timestamp with time zone NOT NULL
);


ALTER TABLE metrics OWNER TO wolever;

--
-- Name: metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE metrics_id_seq OWNER TO wolever;

--
-- Name: metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE metrics_id_seq OWNED BY metrics.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE migrations OWNER TO wolever;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE migrations_id_seq OWNER TO wolever;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE migrations_id_seq OWNED BY migrations.id;


--
-- Name: performer_verification_log; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE performer_verification_log (
    id integer NOT NULL,
    user_id integer,
    application_id character varying(64),
    request_id character varying(128) NOT NULL,
    status character varying(64) NOT NULL,
    data jsonb,
    "createdOn" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE performer_verification_log OWNER TO wolever;

--
-- Name: performer_verification_log_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE performer_verification_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE performer_verification_log_id_seq OWNER TO wolever;

--
-- Name: performer_verification_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE performer_verification_log_id_seq OWNED BY performer_verification_log.id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE referrals (
    id integer NOT NULL,
    from_username character varying(255),
    from_user_id integer,
    to_user_id integer NOT NULL,
    "createdOn" timestamp with time zone NOT NULL,
    "updatedOn" timestamp with time zone NOT NULL
);


ALTER TABLE referrals OWNER TO wolever;

--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE referrals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE referrals_id_seq OWNER TO wolever;

--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE referrals_id_seq OWNED BY referrals.id;


--
-- Name: tips; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE tips (
    id integer NOT NULL,
    from_address eth_address NOT NULL,
    from_user_id integer NOT NULL,
    to_user_id integer NOT NULL,
    camshow_id integer,
    amount eth_amount NOT NULL,
    source character varying(32),
    "createdOn" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    meta jsonb,
    hub_token character varying(128),
    currency currency_name
);


ALTER TABLE tips OWNER TO wolever;

--
-- Name: tips_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE tips_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE tips_id_seq OWNER TO wolever;

--
-- Name: tips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE tips_id_seq OWNED BY tips.id;


--
-- Name: tos_acceptance; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE tos_acceptance (
    id integer NOT NULL,
    anon_user_id character varying(20) NOT NULL,
    user_id integer,
    wallet_address eth_address,
    first_seen timestamp with time zone NOT NULL,
    over_18_agreed_on timestamp with time zone,
    wallet_tos_accepted_on timestamp with time zone,
    ip_address character varying(40),
    ip_address_prefix character varying(20),
    ip_address_hash character varying(64)
);


ALTER TABLE tos_acceptance OWNER TO wolever;

--
-- Name: tos_acceptance_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE tos_acceptance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE tos_acceptance_id_seq OWNER TO wolever;

--
-- Name: tos_acceptance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE tos_acceptance_id_seq OWNED BY tos_acceptance.id;


--
-- Name: user_performers; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE user_performers (
    id integer NOT NULL,
    user_id integer,
    performer_secret_token character varying(255) NOT NULL,
    account_status character varying(255) NOT NULL,
    accepted_on timestamp with time zone,
    "createdOn" timestamp with time zone NOT NULL,
    "updatedOn" timestamp with time zone NOT NULL,
    "deletedOn" timestamp with time zone
);


ALTER TABLE user_performers OWNER TO wolever;

--
-- Name: user_performers_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE user_performers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE user_performers_id_seq OWNER TO wolever;

--
-- Name: user_performers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE user_performers_id_seq OWNED BY user_performers.id;


--
-- Name: user_photos; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE user_photos (
    id integer NOT NULL,
    user_id integer,
    image character varying(255),
    image_sha1 character varying(255),
    image_width integer,
    image_height integer,
    thumbnail character varying(255),
    thumbnail_width integer,
    thumbnail_height integer,
    "createdOn" timestamp with time zone NOT NULL,
    "updatedOn" timestamp with time zone NOT NULL,
    "deletedOn" timestamp with time zone
);


ALTER TABLE user_photos OWNER TO wolever;

--
-- Name: user_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE user_photos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE user_photos_id_seq OWNER TO wolever;

--
-- Name: user_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE user_photos_id_seq OWNED BY user_photos.id;


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE user_profiles (
    id integer NOT NULL,
    user_id integer,
    location character varying(255),
    bio text,
    birthday timestamp with time zone,
    fields jsonb DEFAULT '{}'::jsonb,
    "createdOn" timestamp with time zone NOT NULL,
    "updatedOn" timestamp with time zone NOT NULL,
    "deletedOn" timestamp with time zone,
    CONSTRAINT user_profiles_bio_length CHECK ((length(bio) < (1024 * 1024)))
);


ALTER TABLE user_profiles OWNER TO wolever;

--
-- Name: user_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE user_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE user_profiles_id_seq OWNER TO wolever;

--
-- Name: user_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE user_profiles_id_seq OWNED BY user_profiles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE users (
    id integer NOT NULL,
    username citext NOT NULL,
    wallet_address eth_address NOT NULL,
    email_address citext,
    name character varying(255),
    main_photo_url character varying(255),
    roles character varying(32),
    "createdOn" timestamp with time zone NOT NULL,
    "updatedOn" timestamp with time zone NOT NULL,
    "deletedOn" timestamp with time zone,
    fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT users_roles_is_valid CHECK (((roles IS NULL) OR ((roles)::text = ANY ((ARRAY['admin'::character varying, 'performer'::character varying, 'performer:pending'::character varying])::text[]))))
);


ALTER TABLE users OWNER TO wolever;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE users_id_seq OWNER TO wolever;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE users_id_seq OWNED BY users.id;


--
-- Name: v_performer_join_leave_events; Type: VIEW; Schema: public; Owner: wolever
--

CREATE VIEW v_performer_join_leave_events AS
 SELECT cs.id AS camshow_id,
    cs.performer_id,
    ce.id,
    ce.sender_or_anon_id,
    ce.name,
    timezone('utc'::text, ce."createdOn") AS created,
    lead(ce.id, 1) OVER w AS next_id,
    lead(ce.name, 1) OVER w AS next_name,
    timezone('utc'::text, lead(ce."createdOn", 1) OVER w) AS next_created,
    lead(ce.camshow_id, 1) OVER w AS next_cs
   FROM (camshows cs
     JOIN camshow_events ce ON ((ce.camshow_id = cs.id)))
  WHERE ((to_integer((ce.sender_or_anon_id)::text) IS NOT NULL) AND (to_integer((ce.sender_or_anon_id)::text) = cs.performer_id) AND ((ce.name)::text ~~ 'user.%'::text))
  WINDOW w AS (PARTITION BY cs.id, cs.performer_id ORDER BY ce.id);


ALTER TABLE v_performer_join_leave_events OWNER TO wolever;

--
-- Name: v_camshow_performer_durations; Type: VIEW; Schema: public; Owner: wolever
--

CREATE VIEW v_camshow_performer_durations AS
 SELECT v_performer_join_leave_events.camshow_id,
    v_performer_join_leave_events.performer_id,
    sum((date_part('epoch'::text, (v_performer_join_leave_events.next_created - v_performer_join_leave_events.created)) / ((60 * 60))::double precision)) AS duration
   FROM v_performer_join_leave_events
  WHERE ((v_performer_join_leave_events.name)::text = 'user.join'::text)
  GROUP BY v_performer_join_leave_events.camshow_id, v_performer_join_leave_events.performer_id;


ALTER TABLE v_camshow_performer_durations OWNER TO wolever;

--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: wolever
--

CREATE TABLE withdrawals (
    id integer NOT NULL,
    user_id integer,
    refreshed_at timestamp with time zone,
    refresh_error character varying(255),
    hub_id integer,
    recipient eth_address,
    amount_usd numeric(100,2),
    amount_eth eth_amount,
    txhash character varying(255),
    status character varying(16),
    hub_created_at timestamp with time zone,
    hub_confirmed_at timestamp with time zone,
    hub_failed_at timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE withdrawals OWNER TO wolever;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: wolever
--

CREATE SEQUENCE withdrawals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE withdrawals_id_seq OWNER TO wolever;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: wolever
--

ALTER SEQUENCE withdrawals_id_seq OWNED BY withdrawals.id;


--
-- Name: announcement_views id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY announcement_views ALTER COLUMN id SET DEFAULT nextval('announcement_views_id_seq'::regclass);


--
-- Name: bad_message_log id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY bad_message_log ALTER COLUMN id SET DEFAULT nextval('bad_message_log_id_seq'::regclass);


--
-- Name: camshow_events id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY camshow_events ALTER COLUMN id SET DEFAULT nextval('camshow_events_id_seq'::regclass);


--
-- Name: camshow_membership id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY camshow_membership ALTER COLUMN id SET DEFAULT nextval('camshow_membership_id_seq'::regclass);


--
-- Name: camshows id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY camshows ALTER COLUMN id SET DEFAULT nextval('camshows_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chat_messages ALTER COLUMN id SET DEFAULT nextval('chat_messages_id_seq'::regclass);


--
-- Name: metrics id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY metrics ALTER COLUMN id SET DEFAULT nextval('metrics_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY migrations ALTER COLUMN id SET DEFAULT nextval('migrations_id_seq'::regclass);


--
-- Name: performer_verification_log id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY performer_verification_log ALTER COLUMN id SET DEFAULT nextval('performer_verification_log_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY referrals ALTER COLUMN id SET DEFAULT nextval('referrals_id_seq'::regclass);


--
-- Name: tips id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY tips ALTER COLUMN id SET DEFAULT nextval('tips_id_seq'::regclass);


--
-- Name: tos_acceptance id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY tos_acceptance ALTER COLUMN id SET DEFAULT nextval('tos_acceptance_id_seq'::regclass);


--
-- Name: user_performers id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_performers ALTER COLUMN id SET DEFAULT nextval('user_performers_id_seq'::regclass);


--
-- Name: user_photos id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_photos ALTER COLUMN id SET DEFAULT nextval('user_photos_id_seq'::regclass);


--
-- Name: user_profiles id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_profiles ALTER COLUMN id SET DEFAULT nextval('user_profiles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);


--
-- Name: withdrawals id; Type: DEFAULT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY withdrawals ALTER COLUMN id SET DEFAULT nextval('withdrawals_id_seq'::regclass);


--
-- Data for Name: announcement_views; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY announcement_views (id, user_or_anon_id, announcement_name) FROM stdin;
\.


--
-- Name: announcement_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('announcement_views_id_seq', 1, false);


--
-- Data for Name: bad_message_log; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY bad_message_log (id, user_or_anon_id, camshow_id, reported_by, report_type, history_item, "createdOn", "updatedAt", "deletedOn") FROM stdin;
\.


--
-- Name: bad_message_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('bad_message_log_id_seq', 1, false);


--
-- Data for Name: camshow_events; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY camshow_events (id, sender_or_anon_id, camshow_id, name, data, "createdOn", "updatedOn", "deletedOn") FROM stdin;
\.


--
-- Name: camshow_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('camshow_events_id_seq', 1, false);


--
-- Data for Name: camshow_membership; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY camshow_membership (id, performer_id, member_or_anon_id, status, "createdOn", "updatedOn", "deletedOn") FROM stdin;
\.


--
-- Name: camshow_membership_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('camshow_membership_id_seq', 1, false);


--
-- Data for Name: camshows; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY camshows (id, performer_id, started_at, ended_at, state, feed_id, tip_total_eth, tip_highest_id, tip_highest_eth, tip_latest_id, tip_latest_eth, "createdOn", "updatedOn", "deletedOn", was_promoted, base_currency) FROM stdin;
1	3	2018-10-14 22:52:31.729-04	\N	{"subject": "Fake Show #0, no video or tipping", "streamUrl": "www.facebook.com"}	0@75a06d01-2438-4012-a70d-7cf18f2d031f	0.000000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.73-04	2018-10-14 22:52:31.73-04	\N	\N	\N
2	4	2018-10-14 22:52:31.751-04	\N	{"subject": "Fake Show #1, no video or tipping", "streamUrl": "www.facebook.com"}	1@75a06d01-2438-4012-a70d-7cf18f2d031f	0.100000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.751-04	2018-10-14 22:52:31.751-04	\N	\N	\N
3	5	2018-10-14 22:52:31.775-04	\N	{"subject": "Fake Show #2, no video or tipping", "streamUrl": "www.facebook.com"}	2@75a06d01-2438-4012-a70d-7cf18f2d031f	0.200000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.776-04	2018-10-14 22:52:31.776-04	\N	\N	\N
4	6	2018-10-14 22:52:31.793-04	\N	{"subject": "Fake Show #3, no video or tipping", "streamUrl": "www.facebook.com"}	3@75a06d01-2438-4012-a70d-7cf18f2d031f	0.300000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.793-04	2018-10-14 22:52:31.793-04	\N	\N	\N
5	7	2018-10-14 22:52:31.81-04	\N	{"subject": "Fake Show #4, no video or tipping", "streamUrl": "www.facebook.com"}	4@75a06d01-2438-4012-a70d-7cf18f2d031f	0.400000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.81-04	2018-10-14 22:52:31.81-04	\N	\N	\N
6	8	2018-10-14 22:52:31.824-04	\N	{"subject": "Fake Show #5, no video or tipping", "streamUrl": "www.facebook.com"}	5@75a06d01-2438-4012-a70d-7cf18f2d031f	0.500000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.825-04	2018-10-14 22:52:31.825-04	\N	\N	\N
7	9	2018-10-14 22:52:31.836-04	\N	{"subject": "Fake Show #6, no video or tipping", "streamUrl": "www.facebook.com"}	6@75a06d01-2438-4012-a70d-7cf18f2d031f	0.600000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.836-04	2018-10-14 22:52:31.836-04	\N	\N	\N
8	10	2018-10-14 22:52:31.848-04	\N	{"subject": "Fake Show #7, no video or tipping", "streamUrl": "www.facebook.com"}	7@75a06d01-2438-4012-a70d-7cf18f2d031f	0.700000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.848-04	2018-10-14 22:52:31.848-04	\N	\N	\N
9	11	2018-10-14 22:52:31.887-04	\N	{"subject": "Fake Show #8, no video or tipping", "streamUrl": "www.facebook.com"}	8@75a06d01-2438-4012-a70d-7cf18f2d031f	0.800000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.888-04	2018-10-14 22:52:31.888-04	\N	\N	\N
10	12	2018-10-14 22:52:31.903-04	\N	{"subject": "Fake Show #9, no video or tipping", "streamUrl": "www.facebook.com"}	9@75a06d01-2438-4012-a70d-7cf18f2d031f	0.900000000000000000	\N	0.000000000000000000	\N	0.000000000000000000	2018-10-14 22:52:31.904-04	2018-10-14 22:52:31.904-04	\N	\N	\N
\.


--
-- Name: camshows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('camshows_id_seq', 10, true);


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY chat_messages (id, "timestamp", user_id, anon_user_id, camshow_id, text, was_filtered) FROM stdin;
\.


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('chat_messages_id_seq', 1, false);


--
-- Data for Name: metrics; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY metrics (id, ts, sender_id, name, data, server_time) FROM stdin;
1	2018-10-14 22:54:16.64-04	a:qTpQ8y82xWXJTZ	vynos:initTimeout	{"duration": 7.478}	2018-10-14 22:54:16.669575-04
2	2018-10-14 22:55:01.676-04	a:qTpQ8y82xWXJTZ	vynos:initTimeout	{"duration": 7.001}	2018-10-14 22:55:01.693556-04
3	2018-10-14 22:55:26.321-04	a:IPZo3eeLl/5Ckx	vynos:initTimeout	{"duration": 7.005}	2018-10-14 22:55:26.333576-04
4	2018-10-14 22:55:39.202-04	a:IPZo3eeLl/5Ckx	vynos:initTimeout	{"duration": 7.002}	2018-10-14 22:55:39.217107-04
\.


--
-- Name: metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('metrics_id_seq', 4, true);


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY migrations (id, name, run_on) FROM stdin;
1	/0001-initial	2018-10-14 22:52:31.253
2	/0002-metrics	2018-10-14 22:52:31.287
3	/0002-camshow-membership	2018-10-14 22:52:31.321
4	/0003-tips-meta-column	2018-10-14 22:52:31.335
5	/0004-camshow-events-id-number-to-str	2018-10-14 22:52:31.357
6	/0005-performer-onboarding	2018-10-14 22:52:31.381
7	/0005-unique-user-photos	2018-10-14 22:52:31.397
8	/0006-user-profile-bio-length	2018-10-14 22:52:31.412
9	/0007-tip-add-hub-token	2018-10-14 22:52:31.431
10	/0008-rename-muted-user-to-bad-message-log	2018-10-14 22:52:31.454
11	/0009-camshow-membership-make-index-conditional	2018-10-14 22:52:31.468
12	/0010-camshow-membership-allow-anon	2018-10-14 22:52:31.486
13	/0011-camshow-add-waspromoted	2018-10-14 22:52:31.5
14	/0012-clip-and-camshow-events-index	2018-10-14 22:52:31.517
15	/0013-add-to-integer	2018-10-14 22:52:31.53
16	/0014-add-user-fields	2018-10-14 22:52:31.548
17	/0014-announcement-views	2018-10-14 22:52:31.566
18	/0015-user-referrals	2018-10-14 22:52:31.589
19	/0016-v-performer-camshow-durations	2018-10-14 22:52:31.61
20	/0017-add-currency-types	2018-10-14 22:52:31.635
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('migrations_id_seq', 20, true);


--
-- Data for Name: performer_verification_log; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY performer_verification_log (id, user_id, application_id, request_id, status, data, "createdOn", "updatedAt") FROM stdin;
\.


--
-- Name: performer_verification_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('performer_verification_log_id_seq', 1, false);


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY referrals (id, from_username, from_user_id, to_user_id, "createdOn", "updatedOn") FROM stdin;
\.


--
-- Name: referrals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('referrals_id_seq', 1, false);


--
-- Data for Name: tips; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY tips (id, from_address, from_user_id, to_user_id, camshow_id, amount, source, "createdOn", "updatedAt", meta, hub_token, currency) FROM stdin;
\.


--
-- Name: tips_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('tips_id_seq', 1, false);


--
-- Data for Name: tos_acceptance; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY tos_acceptance (id, anon_user_id, user_id, wallet_address, first_seen, over_18_agreed_on, wallet_tos_accepted_on, ip_address, ip_address_prefix, ip_address_hash) FROM stdin;
\.


--
-- Name: tos_acceptance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('tos_acceptance_id_seq', 1, false);


--
-- Data for Name: user_performers; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY user_performers (id, user_id, performer_secret_token, account_status, accepted_on, "createdOn", "updatedOn", "deletedOn") FROM stdin;
\.


--
-- Name: user_performers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('user_performers_id_seq', 1, false);


--
-- Data for Name: user_photos; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY user_photos (id, user_id, image, image_sha1, image_width, image_height, thumbnail, thumbnail_width, thumbnail_height, "createdOn", "updatedOn", "deletedOn") FROM stdin;
\.


--
-- Name: user_photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('user_photos_id_seq', 1, false);


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY user_profiles (id, user_id, location, bio, birthday, fields, "createdOn", "updatedOn", "deletedOn") FROM stdin;
1	3	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.723-04	2018-10-14 22:52:31.723-04	\N
2	4	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.746-04	2018-10-14 22:52:31.746-04	\N
3	5	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.769-04	2018-10-14 22:52:31.769-04	\N
4	6	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.79-04	2018-10-14 22:52:31.79-04	\N
5	7	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.805-04	2018-10-14 22:52:31.805-04	\N
6	8	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.821-04	2018-10-14 22:52:31.821-04	\N
7	9	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.832-04	2018-10-14 22:52:31.832-04	\N
8	10	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.844-04	2018-10-14 22:52:31.844-04	\N
9	11	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.856-04	2018-10-14 22:52:31.856-04	\N
10	12	Venice, California	Hello, I'm Butter Bubble. I'm 21, I moved to NYC when I was 18 to live by myself and I'm currently residing in Brooklyn. My favorite things are cosplaying, anime, pretty food, rilakkuma, cute girls and exhibitionism. Nice to meet you!	1990-09-05 00:00:00-04	{"socialLinks": [{"handle": "sampleuseraccount", "prependURL": "https://www.twitter.com/", "serviceName": "Twitter"}, {"handle": "sampleuseraccount", "prependURL": "https://www.instagram.com/", "serviceName": "Instagram"}, {"handle": "sampleuseraccount", "prependURL": "https://www.amazon.com/", "serviceName": "Amazon"}, {"handle": "sampleuseraccount", "prependURL": "https://www.snapchat.com/add/", "serviceName": "Snapchat"}, {"handle": "", "prependURL": "", "serviceName": "Website"}]}	2018-10-14 22:52:31.9-04	2018-10-14 22:52:31.9-04	\N
\.


--
-- Name: user_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('user_profiles_id_seq', 10, true);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY users (id, username, wallet_address, email_address, name, main_photo_url, roles, "createdOn", "updatedOn", "deletedOn", fields) FROM stdin;
1	AdminUser	0x69d6622deCe394b54999Fbd73D108123806f6a10	admin@spankchain.com	Admin User	\N	admin	2018-10-14 22:52:31.646-04	2018-10-14 22:52:31.646-04	\N	{}
2	Regular	0x78d6622deCe394b54999Fbd73D108123806f6a10	regular@spankchain.com	Regular User	\N	\N	2018-10-14 22:52:31.709-04	2018-10-14 22:52:31.709-04	\N	{}
3	DaringNails46	0x02d6622deCe394b54999Fbd73D108123806f6a10	test-0@test.com	Daring Nails	\N	performer	2018-10-14 22:52:31.717-04	2018-10-14 22:52:31.717-04	\N	{}
4	LusciousWrists16	0x12d6622deCe394b54999Fbd73D108123806f6a11	test-1@test.com	Luscious Wrists	\N	performer	2018-10-14 22:52:31.741-04	2018-10-14 22:52:31.741-04	\N	{}
5	IrresistibleTouch26	0x22d6622deCe394b54999Fbd73D108123806f6a12	test-2@test.com	Irresistible Touch	\N	performer	2018-10-14 22:52:31.759-04	2018-10-14 22:52:31.759-04	\N	{}
6	MercilessWelcome39	0x32d6622deCe394b54999Fbd73D108123806f6a13	test-3@test.com	Merciless Welcome	\N	performer	2018-10-14 22:52:31.786-04	2018-10-14 22:52:31.786-04	\N	{}
7	SlickSweat69	0x42d6622deCe394b54999Fbd73D108123806f6a14	test-4@test.com	Slick Sweat	\N	performer	2018-10-14 22:52:31.798-04	2018-10-14 22:52:31.798-04	\N	{}
8	FerventNavel64	0x52d6622deCe394b54999Fbd73D108123806f6a15	test-5@test.com	Fervent Navel	\N	performer	2018-10-14 22:52:31.815-04	2018-10-14 22:52:31.815-04	\N	{}
9	SexyGoosebumps66	0x62d6622deCe394b54999Fbd73D108123806f6a16	test-6@test.com	Sexy Goosebumps	\N	performer	2018-10-14 22:52:31.828-04	2018-10-14 22:52:31.828-04	\N	{}
10	SavageRumble56	0x72d6622deCe394b54999Fbd73D108123806f6a17	test-7@test.com	Savage Rumble	\N	performer	2018-10-14 22:52:31.841-04	2018-10-14 22:52:31.841-04	\N	{}
11	PatientPassion44	0x82d6622deCe394b54999Fbd73D108123806f6a18	test-8@test.com	Patient Passion	\N	performer	2018-10-14 22:52:31.852-04	2018-10-14 22:52:31.852-04	\N	{}
12	GloriousEar46	0x92d6622deCe394b54999Fbd73D108123806f6a19	test-9@test.com	Glorious Ear	\N	performer	2018-10-14 22:52:31.896-04	2018-10-14 22:52:31.896-04	\N	{}
\.


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('users_id_seq', 12, true);


--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: wolever
--

COPY withdrawals (id, user_id, refreshed_at, refresh_error, hub_id, recipient, amount_usd, amount_eth, txhash, status, hub_created_at, hub_confirmed_at, hub_failed_at, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Name: withdrawals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: wolever
--

SELECT pg_catalog.setval('withdrawals_id_seq', 1, false);


--
-- Name: announcement_views announcement_views_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY announcement_views
    ADD CONSTRAINT announcement_views_pkey PRIMARY KEY (id);


--
-- Name: bad_message_log bad_message_log_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY bad_message_log
    ADD CONSTRAINT bad_message_log_pkey PRIMARY KEY (id);


--
-- Name: camshow_events camshow_events_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY camshow_events
    ADD CONSTRAINT camshow_events_pkey PRIMARY KEY (id);


--
-- Name: camshow_membership camshow_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY camshow_membership
    ADD CONSTRAINT camshow_membership_pkey PRIMARY KEY (id);


--
-- Name: camshows camshows_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY camshows
    ADD CONSTRAINT camshows_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: metrics metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY metrics
    ADD CONSTRAINT metrics_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: performer_verification_log performer_verification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY performer_verification_log
    ADD CONSTRAINT performer_verification_log_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_to_user_id_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY referrals
    ADD CONSTRAINT referrals_to_user_id_key UNIQUE (to_user_id);


--
-- Name: tips tips_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY tips
    ADD CONSTRAINT tips_pkey PRIMARY KEY (id);


--
-- Name: tos_acceptance tos_acceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY tos_acceptance
    ADD CONSTRAINT tos_acceptance_pkey PRIMARY KEY (id);


--
-- Name: user_performers user_performers_performer_secret_token_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_performers
    ADD CONSTRAINT user_performers_performer_secret_token_key UNIQUE (performer_secret_token);


--
-- Name: user_performers user_performers_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_performers
    ADD CONSTRAINT user_performers_pkey PRIMARY KEY (id);


--
-- Name: user_photos user_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_photos
    ADD CONSTRAINT user_photos_pkey PRIMARY KEY (id);


--
-- Name: user_photos user_photos_unique_user_id; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_photos
    ADD CONSTRAINT user_photos_unique_user_id UNIQUE (user_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: users users_wallet_address_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_wallet_address_key UNIQUE (wallet_address);


--
-- Name: withdrawals withdrawals_hub_id_key; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY withdrawals
    ADD CONSTRAINT withdrawals_hub_id_key UNIQUE (hub_id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: announcement_views_user_or_anon_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX announcement_views_user_or_anon_id ON announcement_views USING btree (user_or_anon_id);


--
-- Name: bad_message_log_camshow_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX bad_message_log_camshow_id ON bad_message_log USING btree (camshow_id);


--
-- Name: bad_message_log_user_or_anon_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX bad_message_log_user_or_anon_id ON bad_message_log USING btree (user_or_anon_id);


--
-- Name: camshow_events_camshow_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX camshow_events_camshow_id ON camshow_events USING btree (camshow_id);


--
-- Name: camshow_events_created_on; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX camshow_events_created_on ON camshow_events USING btree ("createdOn");


--
-- Name: camshow_events_sender_or_anon_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX camshow_events_sender_or_anon_id ON camshow_events USING btree (to_integer((sender_or_anon_id)::text), name) WHERE (to_integer((sender_or_anon_id)::text) IS NOT NULL);


--
-- Name: camshow_membership_performer_member; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX camshow_membership_performer_member ON camshow_membership USING btree (performer_id, member_or_anon_id) WHERE ("deletedOn" IS NOT NULL);


--
-- Name: camshow_membership_unique_performer_member; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX camshow_membership_unique_performer_member ON camshow_membership USING btree (performer_id, member_or_anon_id) WHERE ("deletedOn" IS NULL);


--
-- Name: chat_messages_anon_user_id_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX chat_messages_anon_user_id_idx ON chat_messages USING btree (anon_user_id) WHERE (anon_user_id IS NOT NULL);


--
-- Name: chat_messages_user_id_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX chat_messages_user_id_idx ON chat_messages USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: performer_verification_log_user_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX performer_verification_log_user_id ON performer_verification_log USING btree (user_id);


--
-- Name: tip_hub_token_unique; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX tip_hub_token_unique ON tips USING btree (hub_token) WHERE ((hub_token)::text <> '__DEV_DEBUG_TIP__'::text);


--
-- Name: tos_acceptance_anon_user_id; Type: INDEX; Schema: public; Owner: wolever
--

CREATE UNIQUE INDEX tos_acceptance_anon_user_id ON tos_acceptance USING btree (anon_user_id);


--
-- Name: tos_acceptance_user_id_idx; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX tos_acceptance_user_id_idx ON tos_acceptance USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: users_username; Type: INDEX; Schema: public; Owner: wolever
--

CREATE INDEX users_username ON users USING btree (username);


--
-- Name: camshow_events camshow_events_camshow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY camshow_events
    ADD CONSTRAINT camshow_events_camshow_id_fkey FOREIGN KEY (camshow_id) REFERENCES camshows(id) ON DELETE CASCADE;


--
-- Name: camshows camshows_performer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY camshows
    ADD CONSTRAINT camshows_performer_id_fkey FOREIGN KEY (performer_id) REFERENCES users(id) ON UPDATE CASCADE;


--
-- Name: chat_messages chat_messages_camshow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chat_messages
    ADD CONSTRAINT chat_messages_camshow_id_fkey FOREIGN KEY (camshow_id) REFERENCES camshows(id) ON UPDATE CASCADE;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: performer_verification_log performer_verification_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY performer_verification_log
    ADD CONSTRAINT performer_verification_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: referrals referrals_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY referrals
    ADD CONSTRAINT referrals_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES users(id) ON UPDATE CASCADE;


--
-- Name: referrals referrals_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY referrals
    ADD CONSTRAINT referrals_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES users(id) ON UPDATE CASCADE;


--
-- Name: tips tips_camshow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY tips
    ADD CONSTRAINT tips_camshow_id_fkey FOREIGN KEY (camshow_id) REFERENCES camshows(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tips tips_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY tips
    ADD CONSTRAINT tips_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES users(id) ON UPDATE CASCADE;


--
-- Name: tips tips_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY tips
    ADD CONSTRAINT tips_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES users(id) ON UPDATE CASCADE;


--
-- Name: user_photos user_photos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_photos
    ADD CONSTRAINT user_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: wolever
--

ALTER TABLE ONLY withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE;


--
-- PostgreSQL database dump complete
--

