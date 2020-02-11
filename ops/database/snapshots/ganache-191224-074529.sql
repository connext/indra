--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.16
-- Dumped by pg_dump version 9.6.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: hdb_catalog; Type: SCHEMA; Schema: -; Owner: indra
--

CREATE SCHEMA hdb_catalog;


ALTER SCHEMA hdb_catalog OWNER TO indra;

--
-- Name: hdb_views; Type: SCHEMA; Schema: -; Owner: indra
--

CREATE SCHEMA hdb_views;


ALTER SCHEMA hdb_views OWNER TO indra;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: app_registry_network_enum; Type: TYPE; Schema: public; Owner: indra
--

CREATE TYPE public.app_registry_network_enum AS ENUM (
    'ganache',
    'kovan',
    'rinkeby',
    'ropsten',
    'goerli',
    'homestead'
);


ALTER TYPE public.app_registry_network_enum OWNER TO indra;

--
-- Name: app_registry_outcometype_enum; Type: TYPE; Schema: public; Owner: indra
--

CREATE TYPE public.app_registry_outcometype_enum AS ENUM (
    'TWO_PARTY_FIXED_OUTCOME',
    'MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER',
    'SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER'
);


ALTER TYPE public.app_registry_outcometype_enum OWNER TO indra;

--
-- Name: linked_transfer_status_enum; Type: TYPE; Schema: public; Owner: indra
--

CREATE TYPE public.linked_transfer_status_enum AS ENUM (
    'PENDING',
    'CREATED',
    'REDEEMED',
    'FAILED',
    'RECLAIMED'
);


ALTER TYPE public.linked_transfer_status_enum OWNER TO indra;

--
-- Name: peer_to_peer_transfer_status_enum; Type: TYPE; Schema: public; Owner: indra
--

CREATE TYPE public.peer_to_peer_transfer_status_enum AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED'
);


ALTER TYPE public.peer_to_peer_transfer_status_enum OWNER TO indra;

--
-- Name: transaction_reason_enum; Type: TYPE; Schema: public; Owner: indra
--

CREATE TYPE public.transaction_reason_enum AS ENUM (
    'USER_WITHDRAWAL',
    'COLLATERALIZATION',
    'NODE_WITHDRAWAL'
);


ALTER TYPE public.transaction_reason_enum OWNER TO indra;

--
-- Name: hdb_schema_update_event_notifier(); Type: FUNCTION; Schema: hdb_catalog; Owner: indra
--

CREATE FUNCTION hdb_catalog.hdb_schema_update_event_notifier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  DECLARE
    instance_id uuid;
    occurred_at timestamptz;
    curr_rec record;
  BEGIN
    instance_id = NEW.instance_id;
    occurred_at = NEW.occurred_at;
    PERFORM pg_notify('hasura_schema_update', json_build_object(
      'instance_id', instance_id,
      'occurred_at', occurred_at
      )::text);
    RETURN curr_rec;
  END;
$$;


ALTER FUNCTION hdb_catalog.hdb_schema_update_event_notifier() OWNER TO indra;

--
-- Name: inject_table_defaults(text, text, text, text); Type: FUNCTION; Schema: hdb_catalog; Owner: indra
--

CREATE FUNCTION hdb_catalog.inject_table_defaults(view_schema text, view_name text, tab_schema text, tab_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
        r RECORD;
    BEGIN
      FOR r IN SELECT column_name, column_default FROM information_schema.columns WHERE table_schema = tab_schema AND table_name = tab_name AND column_default IS NOT NULL LOOP
          EXECUTE format('ALTER VIEW %I.%I ALTER COLUMN %I SET DEFAULT %s;', view_schema, view_name, r.column_name, r.column_default);
      END LOOP;
    END;
$$;


ALTER FUNCTION hdb_catalog.inject_table_defaults(view_schema text, view_name text, tab_schema text, tab_name text) OWNER TO indra;

--
-- Name: insert_event_log(text, text, text, text, json); Type: FUNCTION; Schema: hdb_catalog; Owner: indra
--

CREATE FUNCTION hdb_catalog.insert_event_log(schema_name text, table_name text, trigger_name text, op text, row_data json) RETURNS text
    LANGUAGE plpgsql
    AS $$
  DECLARE
    id text;
    payload json;
    session_variables json;
    server_version_num int;
  BEGIN
    id := gen_random_uuid();
    server_version_num := current_setting('server_version_num');
    IF server_version_num >= 90600 THEN
      session_variables := current_setting('hasura.user', 't');
    ELSE
      BEGIN
        session_variables := current_setting('hasura.user');
      EXCEPTION WHEN OTHERS THEN
                  session_variables := NULL;
      END;
    END IF;
    payload := json_build_object(
      'op', op,
      'data', row_data,
      'session_variables', session_variables
    );
    INSERT INTO hdb_catalog.event_log
                (id, schema_name, table_name, trigger_name, payload)
    VALUES
    (id, schema_name, table_name, trigger_name, payload);
    RETURN id;
  END;
$$;


ALTER FUNCTION hdb_catalog.insert_event_log(schema_name text, table_name text, trigger_name text, op text, row_data json) OWNER TO indra;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: event_invocation_logs; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.event_invocation_logs (
    id text DEFAULT public.gen_random_uuid() NOT NULL,
    event_id text,
    status integer,
    request json,
    response json,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE hdb_catalog.event_invocation_logs OWNER TO indra;

--
-- Name: event_log; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.event_log (
    id text DEFAULT public.gen_random_uuid() NOT NULL,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    trigger_name text NOT NULL,
    payload jsonb NOT NULL,
    delivered boolean DEFAULT false NOT NULL,
    error boolean DEFAULT false NOT NULL,
    tries integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    locked boolean DEFAULT false NOT NULL,
    next_retry_at timestamp without time zone
);


ALTER TABLE hdb_catalog.event_log OWNER TO indra;

--
-- Name: event_triggers; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.event_triggers (
    name text NOT NULL,
    type text NOT NULL,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    configuration json,
    comment text
);


ALTER TABLE hdb_catalog.event_triggers OWNER TO indra;

--
-- Name: hdb_allowlist; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.hdb_allowlist (
    collection_name text
);


ALTER TABLE hdb_catalog.hdb_allowlist OWNER TO indra;

--
-- Name: hdb_check_constraint; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_check_constraint AS
 SELECT (n.nspname)::text AS table_schema,
    (ct.relname)::text AS table_name,
    (r.conname)::text AS constraint_name,
    pg_get_constraintdef(r.oid, true) AS "check"
   FROM ((pg_constraint r
     JOIN pg_class ct ON ((r.conrelid = ct.oid)))
     JOIN pg_namespace n ON ((ct.relnamespace = n.oid)))
  WHERE (r.contype = 'c'::"char");


ALTER TABLE hdb_catalog.hdb_check_constraint OWNER TO indra;

--
-- Name: hdb_foreign_key_constraint; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_foreign_key_constraint AS
 SELECT (q.table_schema)::text AS table_schema,
    (q.table_name)::text AS table_name,
    (q.constraint_name)::text AS constraint_name,
    (min(q.constraint_oid))::integer AS constraint_oid,
    min((q.ref_table_table_schema)::text) AS ref_table_table_schema,
    min((q.ref_table)::text) AS ref_table,
    json_object_agg(ac.attname, afc.attname) AS column_mapping,
    min((q.confupdtype)::text) AS on_update,
    min((q.confdeltype)::text) AS on_delete,
    json_agg(ac.attname) AS columns,
    json_agg(afc.attname) AS ref_columns
   FROM ((( SELECT ctn.nspname AS table_schema,
            ct.relname AS table_name,
            r.conrelid AS table_id,
            r.conname AS constraint_name,
            r.oid AS constraint_oid,
            cftn.nspname AS ref_table_table_schema,
            cft.relname AS ref_table,
            r.confrelid AS ref_table_id,
            r.confupdtype,
            r.confdeltype,
            unnest(r.conkey) AS column_id,
            unnest(r.confkey) AS ref_column_id
           FROM ((((pg_constraint r
             JOIN pg_class ct ON ((r.conrelid = ct.oid)))
             JOIN pg_namespace ctn ON ((ct.relnamespace = ctn.oid)))
             JOIN pg_class cft ON ((r.confrelid = cft.oid)))
             JOIN pg_namespace cftn ON ((cft.relnamespace = cftn.oid)))
          WHERE (r.contype = 'f'::"char")) q
     JOIN pg_attribute ac ON (((q.column_id = ac.attnum) AND (q.table_id = ac.attrelid))))
     JOIN pg_attribute afc ON (((q.ref_column_id = afc.attnum) AND (q.ref_table_id = afc.attrelid))))
  GROUP BY q.table_schema, q.table_name, q.constraint_name;


ALTER TABLE hdb_catalog.hdb_foreign_key_constraint OWNER TO indra;

--
-- Name: hdb_primary_key; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_primary_key AS
 SELECT tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    json_agg(constraint_column_usage.column_name) AS columns
   FROM (information_schema.table_constraints tc
     JOIN ( SELECT x.tblschema AS table_schema,
            x.tblname AS table_name,
            x.colname AS column_name,
            x.cstrname AS constraint_name
           FROM ( SELECT DISTINCT nr.nspname,
                    r.relname,
                    a.attname,
                    c.conname
                   FROM pg_namespace nr,
                    pg_class r,
                    pg_attribute a,
                    pg_depend d,
                    pg_namespace nc,
                    pg_constraint c
                  WHERE ((nr.oid = r.relnamespace) AND (r.oid = a.attrelid) AND (d.refclassid = ('pg_class'::regclass)::oid) AND (d.refobjid = r.oid) AND (d.refobjsubid = a.attnum) AND (d.classid = ('pg_constraint'::regclass)::oid) AND (d.objid = c.oid) AND (c.connamespace = nc.oid) AND (c.contype = 'c'::"char") AND (r.relkind = ANY (ARRAY['r'::"char", 'p'::"char"])) AND (NOT a.attisdropped))
                UNION ALL
                 SELECT nr.nspname,
                    r.relname,
                    a.attname,
                    c.conname
                   FROM pg_namespace nr,
                    pg_class r,
                    pg_attribute a,
                    pg_namespace nc,
                    pg_constraint c
                  WHERE ((nr.oid = r.relnamespace) AND (r.oid = a.attrelid) AND (nc.oid = c.connamespace) AND (r.oid =
                        CASE c.contype
                            WHEN 'f'::"char" THEN c.confrelid
                            ELSE c.conrelid
                        END) AND (a.attnum = ANY (
                        CASE c.contype
                            WHEN 'f'::"char" THEN c.confkey
                            ELSE c.conkey
                        END)) AND (NOT a.attisdropped) AND (c.contype = ANY (ARRAY['p'::"char", 'u'::"char", 'f'::"char"])) AND (r.relkind = ANY (ARRAY['r'::"char", 'p'::"char"])))) x(tblschema, tblname, colname, cstrname)) constraint_column_usage ON ((((tc.constraint_name)::text = (constraint_column_usage.constraint_name)::text) AND ((tc.table_schema)::text = (constraint_column_usage.table_schema)::text) AND ((tc.table_name)::text = (constraint_column_usage.table_name)::text))))
  WHERE ((tc.constraint_type)::text = 'PRIMARY KEY'::text)
  GROUP BY tc.table_schema, tc.table_name, tc.constraint_name;


ALTER TABLE hdb_catalog.hdb_primary_key OWNER TO indra;

--
-- Name: hdb_column; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_column AS
 WITH primary_key_references AS (
         SELECT fkey.table_schema AS src_table_schema,
            fkey.table_name AS src_table_name,
            (fkey.columns ->> 0) AS src_column_name,
            json_agg(json_build_object('schema', fkey.ref_table_table_schema, 'name', fkey.ref_table)) AS ref_tables
           FROM (hdb_catalog.hdb_foreign_key_constraint fkey
             JOIN hdb_catalog.hdb_primary_key pkey ON ((((pkey.table_schema)::text = fkey.ref_table_table_schema) AND ((pkey.table_name)::text = fkey.ref_table) AND ((pkey.columns)::jsonb = (fkey.ref_columns)::jsonb))))
          WHERE (json_array_length(fkey.columns) = 1)
          GROUP BY fkey.table_schema, fkey.table_name, (fkey.columns ->> 0)
        )
 SELECT columns.table_schema,
    columns.table_name,
    columns.column_name AS name,
    columns.udt_name AS type,
    columns.is_nullable,
    columns.ordinal_position,
    COALESCE(pkey_refs.ref_tables, '[]'::json) AS primary_key_references
   FROM (information_schema.columns
     LEFT JOIN primary_key_references pkey_refs ON ((((columns.table_schema)::text = pkey_refs.src_table_schema) AND ((columns.table_name)::text = pkey_refs.src_table_name) AND ((columns.column_name)::text = pkey_refs.src_column_name))));


ALTER TABLE hdb_catalog.hdb_column OWNER TO indra;

--
-- Name: hdb_function; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.hdb_function (
    function_schema text NOT NULL,
    function_name text NOT NULL,
    is_system_defined boolean DEFAULT false
);


ALTER TABLE hdb_catalog.hdb_function OWNER TO indra;

--
-- Name: hdb_function_agg; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_function_agg AS
 SELECT (p.proname)::text AS function_name,
    (pn.nspname)::text AS function_schema,
        CASE
            WHEN (p.provariadic = (0)::oid) THEN false
            ELSE true
        END AS has_variadic,
        CASE
            WHEN ((p.provolatile)::text = ('i'::character(1))::text) THEN 'IMMUTABLE'::text
            WHEN ((p.provolatile)::text = ('s'::character(1))::text) THEN 'STABLE'::text
            WHEN ((p.provolatile)::text = ('v'::character(1))::text) THEN 'VOLATILE'::text
            ELSE NULL::text
        END AS function_type,
    pg_get_functiondef(p.oid) AS function_definition,
    (rtn.nspname)::text AS return_type_schema,
    (rt.typname)::text AS return_type_name,
        CASE
            WHEN ((rt.typtype)::text = ('b'::character(1))::text) THEN 'BASE'::text
            WHEN ((rt.typtype)::text = ('c'::character(1))::text) THEN 'COMPOSITE'::text
            WHEN ((rt.typtype)::text = ('d'::character(1))::text) THEN 'DOMAIN'::text
            WHEN ((rt.typtype)::text = ('e'::character(1))::text) THEN 'ENUM'::text
            WHEN ((rt.typtype)::text = ('r'::character(1))::text) THEN 'RANGE'::text
            WHEN ((rt.typtype)::text = ('p'::character(1))::text) THEN 'PSUEDO'::text
            ELSE NULL::text
        END AS return_type_type,
    p.proretset AS returns_set,
    ( SELECT COALESCE(json_agg(q.type_name), '[]'::json) AS "coalesce"
           FROM ( SELECT pt.typname AS type_name,
                    pat.ordinality
                   FROM (unnest(COALESCE(p.proallargtypes, (p.proargtypes)::oid[])) WITH ORDINALITY pat(oid, ordinality)
                     LEFT JOIN pg_type pt ON ((pt.oid = pat.oid)))
                  ORDER BY pat.ordinality) q) AS input_arg_types,
    to_json(COALESCE(p.proargnames, ARRAY[]::text[])) AS input_arg_names,
    p.pronargdefaults AS default_args
   FROM (((pg_proc p
     JOIN pg_namespace pn ON ((pn.oid = p.pronamespace)))
     JOIN pg_type rt ON ((rt.oid = p.prorettype)))
     JOIN pg_namespace rtn ON ((rtn.oid = rt.typnamespace)))
  WHERE (((pn.nspname)::text !~~ 'pg_%'::text) AND ((pn.nspname)::text <> ALL (ARRAY['information_schema'::text, 'hdb_catalog'::text, 'hdb_views'::text])) AND (NOT (EXISTS ( SELECT 1
           FROM pg_aggregate
          WHERE ((pg_aggregate.aggfnoid)::oid = p.oid)))));


ALTER TABLE hdb_catalog.hdb_function_agg OWNER TO indra;

--
-- Name: hdb_function_info_agg; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_function_info_agg AS
 SELECT hdb_function_agg.function_name,
    hdb_function_agg.function_schema,
    row_to_json(( SELECT e.*::record AS e
           FROM ( SELECT hdb_function_agg.has_variadic,
                    hdb_function_agg.function_type,
                    hdb_function_agg.return_type_schema,
                    hdb_function_agg.return_type_name,
                    hdb_function_agg.return_type_type,
                    hdb_function_agg.returns_set,
                    hdb_function_agg.input_arg_types,
                    hdb_function_agg.input_arg_names,
                    hdb_function_agg.default_args,
                    (EXISTS ( SELECT 1
                           FROM information_schema.tables
                          WHERE (((tables.table_schema)::text = hdb_function_agg.return_type_schema) AND ((tables.table_name)::text = hdb_function_agg.return_type_name)))) AS returns_table) e)) AS function_info
   FROM hdb_catalog.hdb_function_agg;


ALTER TABLE hdb_catalog.hdb_function_info_agg OWNER TO indra;

--
-- Name: hdb_permission; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.hdb_permission (
    table_schema text NOT NULL,
    table_name text NOT NULL,
    role_name text NOT NULL,
    perm_type text NOT NULL,
    perm_def jsonb NOT NULL,
    comment text,
    is_system_defined boolean DEFAULT false,
    CONSTRAINT hdb_permission_perm_type_check CHECK ((perm_type = ANY (ARRAY['insert'::text, 'select'::text, 'update'::text, 'delete'::text])))
);


ALTER TABLE hdb_catalog.hdb_permission OWNER TO indra;

--
-- Name: hdb_permission_agg; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_permission_agg AS
 SELECT hdb_permission.table_schema,
    hdb_permission.table_name,
    hdb_permission.role_name,
    json_object_agg(hdb_permission.perm_type, hdb_permission.perm_def) AS permissions
   FROM hdb_catalog.hdb_permission
  GROUP BY hdb_permission.table_schema, hdb_permission.table_name, hdb_permission.role_name;


ALTER TABLE hdb_catalog.hdb_permission_agg OWNER TO indra;

--
-- Name: hdb_query_collection; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.hdb_query_collection (
    collection_name text NOT NULL,
    collection_defn jsonb NOT NULL,
    comment text,
    is_system_defined boolean DEFAULT false
);


ALTER TABLE hdb_catalog.hdb_query_collection OWNER TO indra;

--
-- Name: hdb_relationship; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.hdb_relationship (
    table_schema text NOT NULL,
    table_name text NOT NULL,
    rel_name text NOT NULL,
    rel_type text,
    rel_def jsonb NOT NULL,
    comment text,
    is_system_defined boolean DEFAULT false,
    CONSTRAINT hdb_relationship_rel_type_check CHECK ((rel_type = ANY (ARRAY['object'::text, 'array'::text])))
);


ALTER TABLE hdb_catalog.hdb_relationship OWNER TO indra;

--
-- Name: hdb_schema_update_event; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.hdb_schema_update_event (
    instance_id uuid NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE hdb_catalog.hdb_schema_update_event OWNER TO indra;

--
-- Name: hdb_table; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.hdb_table (
    table_schema text NOT NULL,
    table_name text NOT NULL,
    is_system_defined boolean DEFAULT false,
    is_enum boolean DEFAULT false NOT NULL
);


ALTER TABLE hdb_catalog.hdb_table OWNER TO indra;

--
-- Name: hdb_table_info_agg; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_table_info_agg AS
 SELECT tables.table_name,
    tables.table_schema,
    COALESCE(columns.columns, '[]'::json) AS columns,
    COALESCE(pk.columns, '[]'::json) AS primary_key_columns,
    COALESCE(constraints.constraints, '[]'::json) AS constraints,
    COALESCE(views.view_info, 'null'::json) AS view_info
   FROM ((((information_schema.tables tables
     LEFT JOIN ( SELECT c.table_name,
            c.table_schema,
            json_agg(json_build_object('name', c.name, 'type', c.type, 'is_nullable', (c.is_nullable)::boolean, 'references', c.primary_key_references)) AS columns
           FROM hdb_catalog.hdb_column c
          GROUP BY c.table_schema, c.table_name) columns ON ((((tables.table_schema)::text = (columns.table_schema)::text) AND ((tables.table_name)::text = (columns.table_name)::text))))
     LEFT JOIN ( SELECT hdb_primary_key.table_schema,
            hdb_primary_key.table_name,
            hdb_primary_key.constraint_name,
            hdb_primary_key.columns
           FROM hdb_catalog.hdb_primary_key) pk ON ((((tables.table_schema)::text = (pk.table_schema)::text) AND ((tables.table_name)::text = (pk.table_name)::text))))
     LEFT JOIN ( SELECT c.table_schema,
            c.table_name,
            json_agg(c.constraint_name) AS constraints
           FROM information_schema.table_constraints c
          WHERE (((c.constraint_type)::text = 'UNIQUE'::text) OR ((c.constraint_type)::text = 'PRIMARY KEY'::text))
          GROUP BY c.table_schema, c.table_name) constraints ON ((((tables.table_schema)::text = (constraints.table_schema)::text) AND ((tables.table_name)::text = (constraints.table_name)::text))))
     LEFT JOIN ( SELECT v.table_schema,
            v.table_name,
            json_build_object('is_updatable', ((v.is_updatable)::boolean OR (v.is_trigger_updatable)::boolean), 'is_deletable', ((v.is_updatable)::boolean OR (v.is_trigger_deletable)::boolean), 'is_insertable', ((v.is_insertable_into)::boolean OR (v.is_trigger_insertable_into)::boolean)) AS view_info
           FROM information_schema.views v) views ON ((((tables.table_schema)::text = (views.table_schema)::text) AND ((tables.table_name)::text = (views.table_name)::text))));


ALTER TABLE hdb_catalog.hdb_table_info_agg OWNER TO indra;

--
-- Name: hdb_unique_constraint; Type: VIEW; Schema: hdb_catalog; Owner: indra
--

CREATE VIEW hdb_catalog.hdb_unique_constraint AS
 SELECT tc.table_name,
    tc.constraint_schema AS table_schema,
    tc.constraint_name,
    json_agg(kcu.column_name) AS columns
   FROM (information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu USING (constraint_schema, constraint_name))
  WHERE ((tc.constraint_type)::text = 'UNIQUE'::text)
  GROUP BY tc.table_name, tc.constraint_schema, tc.constraint_name;


ALTER TABLE hdb_catalog.hdb_unique_constraint OWNER TO indra;

--
-- Name: hdb_version; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.hdb_version (
    hasura_uuid uuid DEFAULT public.gen_random_uuid() NOT NULL,
    version text NOT NULL,
    upgraded_on timestamp with time zone NOT NULL,
    cli_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    console_state jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE hdb_catalog.hdb_version OWNER TO indra;

--
-- Name: remote_schemas; Type: TABLE; Schema: hdb_catalog; Owner: indra
--

CREATE TABLE hdb_catalog.remote_schemas (
    id bigint NOT NULL,
    name text,
    definition json,
    comment text
);


ALTER TABLE hdb_catalog.remote_schemas OWNER TO indra;

--
-- Name: remote_schemas_id_seq; Type: SEQUENCE; Schema: hdb_catalog; Owner: indra
--

CREATE SEQUENCE hdb_catalog.remote_schemas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE hdb_catalog.remote_schemas_id_seq OWNER TO indra;

--
-- Name: remote_schemas_id_seq; Type: SEQUENCE OWNED BY; Schema: hdb_catalog; Owner: indra
--

ALTER SEQUENCE hdb_catalog.remote_schemas_id_seq OWNED BY hdb_catalog.remote_schemas.id;


--
-- Name: app_registry; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.app_registry (
    id integer NOT NULL,
    name text NOT NULL,
    network public.app_registry_network_enum NOT NULL,
    "outcomeType" public.app_registry_outcometype_enum NOT NULL,
    "appDefinitionAddress" text NOT NULL,
    "stateEncoding" text NOT NULL,
    "actionEncoding" text,
    "allowNodeInstall" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.app_registry OWNER TO indra;

--
-- Name: app_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: indra
--

CREATE SEQUENCE public.app_registry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.app_registry_id_seq OWNER TO indra;

--
-- Name: app_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: indra
--

ALTER SEQUENCE public.app_registry_id_seq OWNED BY public.app_registry.id;


--
-- Name: channel; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.channel (
    id integer NOT NULL,
    "userPublicIdentifier" text NOT NULL,
    "nodePublicIdentifier" text NOT NULL,
    "multisigAddress" text NOT NULL,
    available boolean DEFAULT false NOT NULL,
    "collateralizationInFlight" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.channel OWNER TO indra;

--
-- Name: channel_id_seq; Type: SEQUENCE; Schema: public; Owner: indra
--

CREATE SEQUENCE public.channel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.channel_id_seq OWNER TO indra;

--
-- Name: channel_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: indra
--

ALTER SEQUENCE public.channel_id_seq OWNED BY public.channel.id;


--
-- Name: channel_payment_profiles_payment_profile; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.channel_payment_profiles_payment_profile (
    "channelId" integer NOT NULL,
    "paymentProfileId" integer NOT NULL
);


ALTER TABLE public.channel_payment_profiles_payment_profile OWNER TO indra;

--
-- Name: linked_transfer; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.linked_transfer (
    id integer NOT NULL,
    amount text NOT NULL,
    "assetId" text NOT NULL,
    "senderAppInstanceId" text NOT NULL,
    "receiverAppInstanceId" text,
    "linkedHash" text NOT NULL,
    "preImage" text,
    "paymentId" text,
    status public.linked_transfer_status_enum DEFAULT 'PENDING'::public.linked_transfer_status_enum NOT NULL,
    "senderChannelId" integer,
    "receiverChannelId" integer,
    "recipientPublicIdentifier" text,
    "encryptedPreImage" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    meta json
);


ALTER TABLE public.linked_transfer OWNER TO indra;

--
-- Name: linked_transfer_id_seq; Type: SEQUENCE; Schema: public; Owner: indra
--

CREATE SEQUENCE public.linked_transfer_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.linked_transfer_id_seq OWNER TO indra;

--
-- Name: linked_transfer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: indra
--

ALTER SEQUENCE public.linked_transfer_id_seq OWNED BY public.linked_transfer.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO indra;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: indra
--

CREATE SEQUENCE public.migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.migrations_id_seq OWNER TO indra;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: indra
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: node_records; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.node_records (
    path character varying NOT NULL,
    value json NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.node_records OWNER TO indra;

--
-- Name: onchain_transaction; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.onchain_transaction (
    id integer NOT NULL,
    reason public.transaction_reason_enum NOT NULL,
    value text NOT NULL,
    "gasPrice" text NOT NULL,
    "gasLimit" text NOT NULL,
    nonce integer NOT NULL,
    "to" text NOT NULL,
    "from" text NOT NULL,
    hash text NOT NULL,
    data text NOT NULL,
    v integer NOT NULL,
    r text NOT NULL,
    s text NOT NULL,
    "channelId" integer
);


ALTER TABLE public.onchain_transaction OWNER TO indra;

--
-- Name: onchain_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: indra
--

CREATE SEQUENCE public.onchain_transaction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.onchain_transaction_id_seq OWNER TO indra;

--
-- Name: onchain_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: indra
--

ALTER SEQUENCE public.onchain_transaction_id_seq OWNED BY public.onchain_transaction.id;


--
-- Name: payment_profile; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.payment_profile (
    id integer NOT NULL,
    "minimumMaintainedCollateral" text DEFAULT '0'::text NOT NULL,
    "amountToCollateralize" text DEFAULT '0'::text NOT NULL,
    "assetId" text NOT NULL
);


ALTER TABLE public.payment_profile OWNER TO indra;

--
-- Name: payment_profile_id_seq; Type: SEQUENCE; Schema: public; Owner: indra
--

CREATE SEQUENCE public.payment_profile_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.payment_profile_id_seq OWNER TO indra;

--
-- Name: payment_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: indra
--

ALTER SEQUENCE public.payment_profile_id_seq OWNED BY public.payment_profile.id;


--
-- Name: peer_to_peer_transfer; Type: TABLE; Schema: public; Owner: indra
--

CREATE TABLE public.peer_to_peer_transfer (
    id integer NOT NULL,
    amount text NOT NULL,
    "assetId" text NOT NULL,
    "appInstanceId" text NOT NULL,
    status public.peer_to_peer_transfer_status_enum DEFAULT 'PENDING'::public.peer_to_peer_transfer_status_enum NOT NULL,
    "senderChannelId" integer,
    "receiverChannelId" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    meta json
);


ALTER TABLE public.peer_to_peer_transfer OWNER TO indra;

--
-- Name: peer_to_peer_transfer_id_seq; Type: SEQUENCE; Schema: public; Owner: indra
--

CREATE SEQUENCE public.peer_to_peer_transfer_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.peer_to_peer_transfer_id_seq OWNER TO indra;

--
-- Name: peer_to_peer_transfer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: indra
--

ALTER SEQUENCE public.peer_to_peer_transfer_id_seq OWNED BY public.peer_to_peer_transfer.id;


--
-- Name: transfer; Type: VIEW; Schema: public; Owner: indra
--

CREATE VIEW public.transfer AS
 SELECT peer_to_peer_transfer.id,
    peer_to_peer_transfer.amount,
    peer_to_peer_transfer."assetId",
    peer_to_peer_transfer.meta,
    peer_to_peer_transfer."createdAt",
    sender_channel."userPublicIdentifier" AS "senderPublicIdentifier",
    receiver_channel."userPublicIdentifier" AS "receiverPublicIdentifier"
   FROM ((public.peer_to_peer_transfer
     LEFT JOIN public.channel receiver_channel ON ((receiver_channel.id = peer_to_peer_transfer."receiverChannelId")))
     LEFT JOIN public.channel sender_channel ON ((sender_channel.id = peer_to_peer_transfer."senderChannelId")))
UNION ALL
 SELECT linked_transfer.id,
    linked_transfer.amount,
    linked_transfer."assetId",
    linked_transfer.meta,
    linked_transfer."createdAt",
    sender_channel."userPublicIdentifier" AS "senderPublicIdentifier",
    receiver_channel."userPublicIdentifier" AS "receiverPublicIdentifier"
   FROM ((public.linked_transfer
     LEFT JOIN public.channel receiver_channel ON ((receiver_channel.id = linked_transfer."receiverChannelId")))
     LEFT JOIN public.channel sender_channel ON ((sender_channel.id = linked_transfer."senderChannelId")));


ALTER TABLE public.transfer OWNER TO indra;

--
-- Name: remote_schemas id; Type: DEFAULT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.remote_schemas ALTER COLUMN id SET DEFAULT nextval('hdb_catalog.remote_schemas_id_seq'::regclass);


--
-- Name: app_registry id; Type: DEFAULT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.app_registry ALTER COLUMN id SET DEFAULT nextval('public.app_registry_id_seq'::regclass);


--
-- Name: channel id; Type: DEFAULT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.channel ALTER COLUMN id SET DEFAULT nextval('public.channel_id_seq'::regclass);


--
-- Name: linked_transfer id; Type: DEFAULT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.linked_transfer ALTER COLUMN id SET DEFAULT nextval('public.linked_transfer_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: onchain_transaction id; Type: DEFAULT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.onchain_transaction ALTER COLUMN id SET DEFAULT nextval('public.onchain_transaction_id_seq'::regclass);


--
-- Name: payment_profile id; Type: DEFAULT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.payment_profile ALTER COLUMN id SET DEFAULT nextval('public.payment_profile_id_seq'::regclass);


--
-- Name: peer_to_peer_transfer id; Type: DEFAULT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.peer_to_peer_transfer ALTER COLUMN id SET DEFAULT nextval('public.peer_to_peer_transfer_id_seq'::regclass);


--
-- Data for Name: event_invocation_logs; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.event_invocation_logs (id, event_id, status, request, response, created_at) FROM stdin;
\.


--
-- Data for Name: event_log; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.event_log (id, schema_name, table_name, trigger_name, payload, delivered, error, tries, created_at, locked, next_retry_at) FROM stdin;
\.


--
-- Data for Name: event_triggers; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.event_triggers (name, type, schema_name, table_name, configuration, comment) FROM stdin;
\.


--
-- Data for Name: hdb_allowlist; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.hdb_allowlist (collection_name) FROM stdin;
\.


--
-- Data for Name: hdb_function; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.hdb_function (function_schema, function_name, is_system_defined) FROM stdin;
\.


--
-- Data for Name: hdb_permission; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.hdb_permission (table_schema, table_name, role_name, perm_type, perm_def, comment, is_system_defined) FROM stdin;
\.


--
-- Data for Name: hdb_query_collection; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.hdb_query_collection (collection_name, collection_defn, comment, is_system_defined) FROM stdin;
\.


--
-- Data for Name: hdb_relationship; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.hdb_relationship (table_schema, table_name, rel_name, rel_type, rel_def, comment, is_system_defined) FROM stdin;
hdb_catalog	hdb_table	detail	object	{"manual_configuration": {"remote_table": {"name": "tables", "schema": "information_schema"}, "column_mapping": {"table_name": "table_name", "table_schema": "table_schema"}}}	\N	t
hdb_catalog	hdb_table	primary_key	object	{"manual_configuration": {"remote_table": {"name": "hdb_primary_key", "schema": "hdb_catalog"}, "column_mapping": {"table_name": "table_name", "table_schema": "table_schema"}}}	\N	t
hdb_catalog	hdb_table	columns	array	{"manual_configuration": {"remote_table": {"name": "columns", "schema": "information_schema"}, "column_mapping": {"table_name": "table_name", "table_schema": "table_schema"}}}	\N	t
hdb_catalog	hdb_table	foreign_key_constraints	array	{"manual_configuration": {"remote_table": {"name": "hdb_foreign_key_constraint", "schema": "hdb_catalog"}, "column_mapping": {"table_name": "table_name", "table_schema": "table_schema"}}}	\N	t
hdb_catalog	hdb_table	relationships	array	{"manual_configuration": {"remote_table": {"name": "hdb_relationship", "schema": "hdb_catalog"}, "column_mapping": {"table_name": "table_name", "table_schema": "table_schema"}}}	\N	t
hdb_catalog	hdb_table	permissions	array	{"manual_configuration": {"remote_table": {"name": "hdb_permission_agg", "schema": "hdb_catalog"}, "column_mapping": {"table_name": "table_name", "table_schema": "table_schema"}}}	\N	t
hdb_catalog	hdb_table	check_constraints	array	{"manual_configuration": {"remote_table": {"name": "hdb_check_constraint", "schema": "hdb_catalog"}, "column_mapping": {"table_name": "table_name", "table_schema": "table_schema"}}}	\N	t
hdb_catalog	hdb_table	unique_constraints	array	{"manual_configuration": {"remote_table": {"name": "hdb_unique_constraint", "schema": "hdb_catalog"}, "column_mapping": {"table_name": "table_name", "table_schema": "table_schema"}}}	\N	t
hdb_catalog	event_log	trigger	object	{"manual_configuration": {"remote_table": {"name": "event_triggers", "schema": "hdb_catalog"}, "column_mapping": {"trigger_name": "name"}}}	\N	t
hdb_catalog	event_triggers	events	array	{"manual_configuration": {"remote_table": {"name": "event_log", "schema": "hdb_catalog"}, "column_mapping": {"name": "trigger_name"}}}	\N	t
hdb_catalog	event_invocation_logs	event	object	{"foreign_key_constraint_on": "event_id"}	\N	t
hdb_catalog	event_log	logs	array	{"foreign_key_constraint_on": {"table": {"name": "event_invocation_logs", "schema": "hdb_catalog"}, "column": "event_id"}}	\N	t
hdb_catalog	hdb_function_agg	return_table_info	object	{"manual_configuration": {"remote_table": {"name": "hdb_table", "schema": "hdb_catalog"}, "column_mapping": {"return_type_name": "table_name", "return_type_schema": "table_schema"}}}	\N	t
\.


--
-- Data for Name: hdb_schema_update_event; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.hdb_schema_update_event (instance_id, occurred_at) FROM stdin;
dbb8d6a3-3a82-4f4f-b99b-6ee9412e7861	2019-11-14 05:04:21.897963+00
\.


--
-- Data for Name: hdb_table; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.hdb_table (table_schema, table_name, is_system_defined, is_enum) FROM stdin;
hdb_catalog	hdb_table	t	f
information_schema	tables	t	f
information_schema	schemata	t	f
information_schema	views	t	f
hdb_catalog	hdb_primary_key	t	f
information_schema	columns	t	f
hdb_catalog	hdb_foreign_key_constraint	t	f
hdb_catalog	hdb_relationship	t	f
hdb_catalog	hdb_permission_agg	t	f
hdb_catalog	hdb_check_constraint	t	f
hdb_catalog	hdb_unique_constraint	t	f
hdb_catalog	event_triggers	t	f
hdb_catalog	event_log	t	f
hdb_catalog	event_invocation_logs	t	f
hdb_catalog	hdb_function_agg	t	f
hdb_catalog	hdb_function	t	f
hdb_catalog	remote_schemas	t	f
hdb_catalog	hdb_version	t	f
hdb_catalog	hdb_query_collection	t	f
hdb_catalog	hdb_allowlist	t	f
\.


--
-- Data for Name: hdb_version; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.hdb_version (hasura_uuid, version, upgraded_on, cli_state, console_state) FROM stdin;
abebb247-925f-459a-bfc3-d093f5666c98	22	2019-11-14 04:57:45.200359+00	{}	{"telemetryNotificationShown": true}
\.


--
-- Data for Name: remote_schemas; Type: TABLE DATA; Schema: hdb_catalog; Owner: indra
--

COPY hdb_catalog.remote_schemas (id, name, definition, comment) FROM stdin;
\.


--
-- Name: remote_schemas_id_seq; Type: SEQUENCE SET; Schema: hdb_catalog; Owner: indra
--

SELECT pg_catalog.setval('hdb_catalog.remote_schemas_id_seq', 1, false);


--
-- Data for Name: app_registry; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.app_registry (id, name, network, "outcomeType", "appDefinitionAddress", "stateEncoding", "actionEncoding", "allowNodeInstall") FROM stdin;
1	SimpleTransferApp	ganache	SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER	0x82D50AD3C1091866E258Fd0f1a7cC9674609D254	tuple(tuple(address to, uint256 amount)[2] coinTransfers)	\N	f
2	SimpleTwoPartySwapApp	ganache	MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER	0xdDA6327139485221633A1FcD65f4aC932E60A2e1	tuple(tuple(address to, uint256 amount)[][] coinTransfers)	\N	t
3	SimpleLinkedTransferApp	ganache	SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER	0x75c35C980C0d37ef46DF04d31A140b65503c0eEd	tuple(tuple(address to, uint256 amount)[2] coinTransfers, bytes32 linkedHash, uint256 amount, address assetId, bytes32 paymentId, bytes32 preImage)	tuple(bytes32 preImage)	t
4	CoinBalanceRefundApp	ganache	SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER	0x345cA3e014Aaf5dcA488057592ee47305D9B3e10	tuple(address recipient, address multisig, uint256 threshold, address tokenAddress)	\N	t
\.


--
-- Name: app_registry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: indra
--

SELECT pg_catalog.setval('public.app_registry_id_seq', 4, true);


--
-- Data for Name: channel; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.channel (id, "userPublicIdentifier", "nodePublicIdentifier", "multisigAddress", available, "collateralizationInFlight") FROM stdin;
7	xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK	xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6	0xfF09fCE6437F6B002Dd9942A5a229dB0980890Df	t	f
\.


--
-- Name: channel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: indra
--

SELECT pg_catalog.setval('public.channel_id_seq', 7, true);


--
-- Data for Name: channel_payment_profiles_payment_profile; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.channel_payment_profiles_payment_profile ("channelId", "paymentProfileId") FROM stdin;
\.


--
-- Data for Name: linked_transfer; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.linked_transfer (id, amount, "assetId", "senderAppInstanceId", "receiverAppInstanceId", "linkedHash", "preImage", "paymentId", status, "senderChannelId", "receiverChannelId", "recipientPublicIdentifier", "encryptedPreImage", "createdAt", "updatedAt", meta) FROM stdin;
\.


--
-- Name: linked_transfer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: indra
--

SELECT pg_catalog.setval('public.linked_transfer_id_seq', 1, false);


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
1	1567158660577	InitNodeRecords1567158660577
2	1567158805166	InitHubTables1567158805166
3	1567601573372	AddCollateralizationInFlight1567601573372
4	1568746114079	AddReclaimedLinks1568746114079
5	1569489199954	AddOnchainTransactions1569489199954
6	1569862328684	AddRecipientToLinks1569862328684
7	1571072372000	AddTransferView1571072372000
8	1574449936874	AddTransferMetas1574449936874
9	1574451273832	AddCfcoreTimestamps1574451273832
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: indra
--

SELECT pg_catalog.setval('public.migrations_id_seq', 9, true);


--
-- Data for Name: node_records; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.node_records (path, value, "createdAt", "updatedAt") FROM stdin;
INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0xfF09fCE6437F6B002Dd9942A5a229dB0980890Df	{"INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0xfF09fCE6437F6B002Dd9942A5a229dB0980890Df":{"multisigAddress":"0xfF09fCE6437F6B002Dd9942A5a229dB0980890Df","proxyFactoryAddress":"0x2C2B9C9a4a25e24B174f26114e8926a9f2128FE4","userNeuteredExtendedKeys":["xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6","xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK"],"proposedAppInstances":[],"appInstances":[],"freeBalanceAppInstance":{"participants":["0xd6e78115B145E6A988159Cc80483E7e6Bcfa12B0","0xF80fd6F5eF91230805508bB28d75248024E50F6F"],"defaultTimeout":172800,"appInterface":{"addr":"0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F","stateEncoding":"tuple(address[] tokenAddresses, tuple(address to, uint256 amount)[][] balances, bytes32[] activeApps)"},"isVirtualApp":false,"appSeqNo":0,"latestState":{"activeApps":[],"tokenAddresses":["0x0000000000000000000000000000000000000000"],"balances":[[{"to":"0xd6e78115B145E6A988159Cc80483E7e6Bcfa12B0","amount":{"_hex":"0x00"}},{"to":"0xF80fd6F5eF91230805508bB28d75248024E50F6F","amount":{"_hex":"0x00"}}]]},"latestVersionNumber":0,"latestTimeout":172800,"outcomeType":"MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER","identityHash":"0xa39ce030ccff21ba4cc1ac7a84634dc3b13eb8d8a7670d65eae20729a9bc4e23"},"monotonicNumProposedApps":1,"singleAssetTwoPartyIntermediaryAgreements":[]}}	2019-12-24 07:41:50.013065	2019-12-24 07:41:50.013065
\.


--
-- Data for Name: onchain_transaction; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.onchain_transaction (id, reason, value, "gasPrice", "gasLimit", nonce, "to", "from", hash, data, v, r, s, "channelId") FROM stdin;
\.


--
-- Name: onchain_transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: indra
--

SELECT pg_catalog.setval('public.onchain_transaction_id_seq', 1, false);


--
-- Data for Name: payment_profile; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.payment_profile (id, "minimumMaintainedCollateral", "amountToCollateralize", "assetId") FROM stdin;
\.


--
-- Name: payment_profile_id_seq; Type: SEQUENCE SET; Schema: public; Owner: indra
--

SELECT pg_catalog.setval('public.payment_profile_id_seq', 1, true);


--
-- Data for Name: peer_to_peer_transfer; Type: TABLE DATA; Schema: public; Owner: indra
--

COPY public.peer_to_peer_transfer (id, amount, "assetId", "appInstanceId", status, "senderChannelId", "receiverChannelId", "createdAt", "updatedAt", meta) FROM stdin;
\.


--
-- Name: peer_to_peer_transfer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: indra
--

SELECT pg_catalog.setval('public.peer_to_peer_transfer_id_seq', 1, false);


--
-- Name: event_invocation_logs event_invocation_logs_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.event_invocation_logs
    ADD CONSTRAINT event_invocation_logs_pkey PRIMARY KEY (id);


--
-- Name: event_log event_log_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.event_log
    ADD CONSTRAINT event_log_pkey PRIMARY KEY (id);


--
-- Name: event_triggers event_triggers_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.event_triggers
    ADD CONSTRAINT event_triggers_pkey PRIMARY KEY (name);


--
-- Name: hdb_allowlist hdb_allowlist_collection_name_key; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_allowlist
    ADD CONSTRAINT hdb_allowlist_collection_name_key UNIQUE (collection_name);


--
-- Name: hdb_function hdb_function_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_function
    ADD CONSTRAINT hdb_function_pkey PRIMARY KEY (function_schema, function_name);


--
-- Name: hdb_permission hdb_permission_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_permission
    ADD CONSTRAINT hdb_permission_pkey PRIMARY KEY (table_schema, table_name, role_name, perm_type);


--
-- Name: hdb_query_collection hdb_query_collection_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_query_collection
    ADD CONSTRAINT hdb_query_collection_pkey PRIMARY KEY (collection_name);


--
-- Name: hdb_relationship hdb_relationship_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_relationship
    ADD CONSTRAINT hdb_relationship_pkey PRIMARY KEY (table_schema, table_name, rel_name);


--
-- Name: hdb_table hdb_table_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_table
    ADD CONSTRAINT hdb_table_pkey PRIMARY KEY (table_schema, table_name);


--
-- Name: hdb_version hdb_version_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_version
    ADD CONSTRAINT hdb_version_pkey PRIMARY KEY (hasura_uuid);


--
-- Name: remote_schemas remote_schemas_name_key; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.remote_schemas
    ADD CONSTRAINT remote_schemas_name_key UNIQUE (name);


--
-- Name: remote_schemas remote_schemas_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.remote_schemas
    ADD CONSTRAINT remote_schemas_pkey PRIMARY KEY (id);


--
-- Name: app_registry PK_0ad3967947b8e96a4e6cbc4827e; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.app_registry
    ADD CONSTRAINT "PK_0ad3967947b8e96a4e6cbc4827e" PRIMARY KEY (id);


--
-- Name: channel PK_590f33ee6ee7d76437acf362e39; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT "PK_590f33ee6ee7d76437acf362e39" PRIMARY KEY (id);


--
-- Name: node_records PK_59679f33ec7b8a5f136be41943d; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.node_records
    ADD CONSTRAINT "PK_59679f33ec7b8a5f136be41943d" PRIMARY KEY (path);


--
-- Name: payment_profile PK_643552fcfc44ed6f6036befe656; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.payment_profile
    ADD CONSTRAINT "PK_643552fcfc44ed6f6036befe656" PRIMARY KEY (id);


--
-- Name: linked_transfer PK_70a97be717001119e55d2238525; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.linked_transfer
    ADD CONSTRAINT "PK_70a97be717001119e55d2238525" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: peer_to_peer_transfer PK_92d949ff4ae3cad8ae841f16b1a; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.peer_to_peer_transfer
    ADD CONSTRAINT "PK_92d949ff4ae3cad8ae841f16b1a" PRIMARY KEY (id);


--
-- Name: channel_payment_profiles_payment_profile PK_bd66c333fa8b5b80eecf1f6a49f; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.channel_payment_profiles_payment_profile
    ADD CONSTRAINT "PK_bd66c333fa8b5b80eecf1f6a49f" PRIMARY KEY ("channelId", "paymentProfileId");


--
-- Name: onchain_transaction onchain_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.onchain_transaction
    ADD CONSTRAINT onchain_transaction_pkey PRIMARY KEY (id);


--
-- Name: event_invocation_logs_event_id_idx; Type: INDEX; Schema: hdb_catalog; Owner: indra
--

CREATE INDEX event_invocation_logs_event_id_idx ON hdb_catalog.event_invocation_logs USING btree (event_id);


--
-- Name: event_log_locked_idx; Type: INDEX; Schema: hdb_catalog; Owner: indra
--

CREATE INDEX event_log_locked_idx ON hdb_catalog.event_log USING btree (locked);


--
-- Name: event_log_trigger_name_idx; Type: INDEX; Schema: hdb_catalog; Owner: indra
--

CREATE INDEX event_log_trigger_name_idx ON hdb_catalog.event_log USING btree (trigger_name);


--
-- Name: hdb_schema_update_event_one_row; Type: INDEX; Schema: hdb_catalog; Owner: indra
--

CREATE UNIQUE INDEX hdb_schema_update_event_one_row ON hdb_catalog.hdb_schema_update_event USING btree (((occurred_at IS NOT NULL)));


--
-- Name: hdb_version_one_row; Type: INDEX; Schema: hdb_catalog; Owner: indra
--

CREATE UNIQUE INDEX hdb_version_one_row ON hdb_catalog.hdb_version USING btree (((version IS NOT NULL)));


--
-- Name: IDX_a5bdc94414f8e850e0c7c108c4; Type: INDEX; Schema: public; Owner: indra
--

CREATE INDEX "IDX_a5bdc94414f8e850e0c7c108c4" ON public.channel_payment_profiles_payment_profile USING btree ("paymentProfileId");


--
-- Name: IDX_e13899dee318fd939719e9b338; Type: INDEX; Schema: public; Owner: indra
--

CREATE INDEX "IDX_e13899dee318fd939719e9b338" ON public.channel_payment_profiles_payment_profile USING btree ("channelId");


--
-- Name: hdb_schema_update_event hdb_schema_update_event_notifier; Type: TRIGGER; Schema: hdb_catalog; Owner: indra
--

CREATE TRIGGER hdb_schema_update_event_notifier AFTER INSERT OR UPDATE ON hdb_catalog.hdb_schema_update_event FOR EACH ROW EXECUTE PROCEDURE hdb_catalog.hdb_schema_update_event_notifier();


--
-- Name: event_invocation_logs event_invocation_logs_event_id_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.event_invocation_logs
    ADD CONSTRAINT event_invocation_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES hdb_catalog.event_log(id);


--
-- Name: event_triggers event_triggers_schema_name_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.event_triggers
    ADD CONSTRAINT event_triggers_schema_name_fkey FOREIGN KEY (schema_name, table_name) REFERENCES hdb_catalog.hdb_table(table_schema, table_name) ON UPDATE CASCADE;


--
-- Name: hdb_allowlist hdb_allowlist_collection_name_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_allowlist
    ADD CONSTRAINT hdb_allowlist_collection_name_fkey FOREIGN KEY (collection_name) REFERENCES hdb_catalog.hdb_query_collection(collection_name);


--
-- Name: hdb_permission hdb_permission_table_schema_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_permission
    ADD CONSTRAINT hdb_permission_table_schema_fkey FOREIGN KEY (table_schema, table_name) REFERENCES hdb_catalog.hdb_table(table_schema, table_name) ON UPDATE CASCADE;


--
-- Name: hdb_relationship hdb_relationship_table_schema_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: indra
--

ALTER TABLE ONLY hdb_catalog.hdb_relationship
    ADD CONSTRAINT hdb_relationship_table_schema_fkey FOREIGN KEY (table_schema, table_name) REFERENCES hdb_catalog.hdb_table(table_schema, table_name) ON UPDATE CASCADE;


--
-- Name: peer_to_peer_transfer FK_1d7f2a32b20c2a27afc62b3bde1; Type: FK CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.peer_to_peer_transfer
    ADD CONSTRAINT "FK_1d7f2a32b20c2a27afc62b3bde1" FOREIGN KEY ("receiverChannelId") REFERENCES public.channel(id);


--
-- Name: linked_transfer FK_2bfee41282e7a522b53588b6b97; Type: FK CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.linked_transfer
    ADD CONSTRAINT "FK_2bfee41282e7a522b53588b6b97" FOREIGN KEY ("senderChannelId") REFERENCES public.channel(id);


--
-- Name: peer_to_peer_transfer FK_83c47d9bfe33419dad37400d5db; Type: FK CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.peer_to_peer_transfer
    ADD CONSTRAINT "FK_83c47d9bfe33419dad37400d5db" FOREIGN KEY ("senderChannelId") REFERENCES public.channel(id);


--
-- Name: linked_transfer FK_a08194603341158bed722a0635f; Type: FK CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.linked_transfer
    ADD CONSTRAINT "FK_a08194603341158bed722a0635f" FOREIGN KEY ("receiverChannelId") REFERENCES public.channel(id);


--
-- Name: channel_payment_profiles_payment_profile FK_a5bdc94414f8e850e0c7c108c46; Type: FK CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.channel_payment_profiles_payment_profile
    ADD CONSTRAINT "FK_a5bdc94414f8e850e0c7c108c46" FOREIGN KEY ("paymentProfileId") REFERENCES public.payment_profile(id) ON DELETE CASCADE;


--
-- Name: channel_payment_profiles_payment_profile FK_e13899dee318fd939719e9b338a; Type: FK CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.channel_payment_profiles_payment_profile
    ADD CONSTRAINT "FK_e13899dee318fd939719e9b338a" FOREIGN KEY ("channelId") REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: onchain_transaction onchain_transaction_channelId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: indra
--

ALTER TABLE ONLY public.onchain_transaction
    ADD CONSTRAINT "onchain_transaction_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES public.channel(id);


--
-- PostgreSQL database dump complete
--

