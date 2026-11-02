--
-- PostgreSQL database dump
--

\restrict YVZLg1fGiT0aMErZmnVf17FksELL9aoDM0dwU2YZE6GVaYYSR1YEtfrdJ5EWKhB

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: application_records_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.application_records_status_enum AS ENUM (
    'Applied',
    'Under Review',
    'Interview Requested',
    'Rejected',
    'Offer'
);


ALTER TYPE public.application_records_status_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analytics_application_trend; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analytics_application_trend (
    id integer NOT NULL,
    month text,
    apps integer,
    interviews integer
);


ALTER TABLE public.analytics_application_trend OWNER TO postgres;

--
-- Name: analytics_application_trend_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.analytics_application_trend_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analytics_application_trend_id_seq OWNER TO postgres;

--
-- Name: analytics_application_trend_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.analytics_application_trend_id_seq OWNED BY public.analytics_application_trend.id;


--
-- Name: analytics_kpi; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analytics_kpi (
    id integer NOT NULL,
    title text,
    value text,
    trend integer,
    trend_data integer[],
    icon_name text
);


ALTER TABLE public.analytics_kpi OWNER TO postgres;

--
-- Name: analytics_kpi_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.analytics_kpi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analytics_kpi_id_seq OWNER TO postgres;

--
-- Name: analytics_kpi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.analytics_kpi_id_seq OWNED BY public.analytics_kpi.id;


--
-- Name: analytics_status_distribution; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analytics_status_distribution (
    id integer NOT NULL,
    name text,
    value integer,
    color text
);


ALTER TABLE public.analytics_status_distribution OWNER TO postgres;

--
-- Name: analytics_status_distribution_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.analytics_status_distribution_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analytics_status_distribution_id_seq OWNER TO postgres;

--
-- Name: analytics_status_distribution_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.analytics_status_distribution_id_seq OWNED BY public.analytics_status_distribution.id;


--
-- Name: application_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.application_records (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "targetRole" character varying NOT NULL,
    company character varying NOT NULL,
    location character varying,
    "salaryRange" character varying,
    status public.application_records_status_enum DEFAULT 'Applied'::public.application_records_status_enum NOT NULL,
    "atsScore" integer NOT NULL,
    "applicationDate" timestamp without time zone DEFAULT now() NOT NULL,
    "clientId" uuid,
    "resumeId" uuid
);


ALTER TABLE public.application_records OWNER TO postgres;

--
-- Name: applications_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applications_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_title text,
    company text,
    location text,
    applied_date date DEFAULT CURRENT_DATE,
    status text,
    ats_score integer,
    resume_version text,
    salary text
);


ALTER TABLE public.applications_list OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "planName" character varying NOT NULL,
    "totalQuota" integer DEFAULT 200 NOT NULL,
    "remainingQuota" integer DEFAULT 200 NOT NULL
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: plan_distribution; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plan_distribution (
    id integer NOT NULL,
    name text,
    client_count integer,
    color text
);


ALTER TABLE public.plan_distribution OWNER TO postgres;

--
-- Name: plan_distribution_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.plan_distribution_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plan_distribution_id_seq OWNER TO postgres;

--
-- Name: plan_distribution_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.plan_distribution_id_seq OWNED BY public.plan_distribution.id;


--
-- Name: resumes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resumes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    target_role character varying NOT NULL,
    ats_score integer NOT NULL,
    used_in_apps integer DEFAULT 0 NOT NULL,
    keywords text[],
    content jsonb
);


ALTER TABLE public.resumes OWNER TO postgres;

--
-- Name: specialists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.specialists (
    id integer NOT NULL,
    name text,
    applications integer,
    interview_rate integer,
    status text
);


ALTER TABLE public.specialists OWNER TO postgres;

--
-- Name: specialists_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.specialists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.specialists_id_seq OWNER TO postgres;

--
-- Name: specialists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.specialists_id_seq OWNED BY public.specialists.id;


--
-- Name: system_health; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_health (
    id integer NOT NULL,
    metric text,
    value text,
    status text,
    icon_name text
);


ALTER TABLE public.system_health OWNER TO postgres;

--
-- Name: system_health_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_health_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_health_id_seq OWNER TO postgres;

--
-- Name: system_health_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_health_id_seq OWNED BY public.system_health.id;


--
-- Name: analytics_application_trend id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_application_trend ALTER COLUMN id SET DEFAULT nextval('public.analytics_application_trend_id_seq'::regclass);


--
-- Name: analytics_kpi id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_kpi ALTER COLUMN id SET DEFAULT nextval('public.analytics_kpi_id_seq'::regclass);


--
-- Name: analytics_status_distribution id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_status_distribution ALTER COLUMN id SET DEFAULT nextval('public.analytics_status_distribution_id_seq'::regclass);


--
-- Name: plan_distribution id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_distribution ALTER COLUMN id SET DEFAULT nextval('public.plan_distribution_id_seq'::regclass);


--
-- Name: specialists id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specialists ALTER COLUMN id SET DEFAULT nextval('public.specialists_id_seq'::regclass);


--
-- Name: system_health id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_health ALTER COLUMN id SET DEFAULT nextval('public.system_health_id_seq'::regclass);


--
-- Data for Name: analytics_application_trend; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.analytics_application_trend (id, month, apps, interviews) FROM stdin;
1	Jan	45	12
2	Feb	52	18
3	Mar	48	15
\.


--
-- Data for Name: analytics_kpi; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.analytics_kpi (id, title, value, trend, trend_data, icon_name) FROM stdin;
1	Total Apps	124	12	{10,15,8,12,20}	Send
\.


--
-- Data for Name: analytics_status_distribution; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.analytics_status_distribution (id, name, value, color) FROM stdin;
1	Applied	65	#3b82f6
2	Interview	20	#10b981
3	Rejected	15	#ef4444
\.


--
-- Data for Name: application_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.application_records (id, "targetRole", company, location, "salaryRange", status, "atsScore", "applicationDate", "clientId", "resumeId") FROM stdin;
\.


--
-- Data for Name: applications_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.applications_list (id, job_title, company, location, applied_date, status, ats_score, resume_version, salary) FROM stdin;
c63d1a5e-9128-4e10-92be-20875d896a04	Full Stack Dev	Cyberpurview	\N	2026-02-28	Applied	95	\N	\N
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, name, "planName", "totalQuota", "remainingQuota") FROM stdin;
11111111-1111-1111-1111-111111111111	TonyStark	Launchpad	200	200
\.


--
-- Data for Name: plan_distribution; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plan_distribution (id, name, client_count, color) FROM stdin;
1	Launchpad	120	#3b82f6
2	Pro	80	#8b5cf6
3	Enterprise	48	#f59e0b
\.


--
-- Data for Name: resumes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resumes (id, user_id, target_role, ats_score, used_in_apps, keywords, content) FROM stdin;
13e4d5d8-34d4-4bc0-bb46-95a73c20b0b8	11111111-1111-1111-1111-111111111111	Data Analyst	92	0	{Python,SQL,PostgreSQL,"Data Analysis","Data Modeling","Data Visualization","ETL Processes","Database Management","Business Intelligence","Microsoft Excel",Linux,"Statistical Analysis","Data Cleaning","Problem Solving",Dashboarding}	{"skills": ["Python", "SQL", "PostgreSQL", "Data Analysis", "Data Modeling", "Data Visualization", "ETL Processes", "Database Management", "Business Intelligence", "Microsoft Excel", "Linux", "Statistical Analysis", "Data Cleaning", "Problem Solving", "Dashboarding"], "summary": "Highly analytical and detail-oriented professional with a strong foundation in database design, programming, and system architecture, eager to transition into a Data Analyst role. Proven ability to design scalable data schemas, manage data integrity, and apply algorithmic thinking to complex problems. Proficient in Python, SQL, and PostgreSQL, with experience in data transformation, performance optimization, and dashboarding to derive actionable insights.", "education": [{"dates": "2022 - Expected 2027", "degree": "B.Eng. Mechanical Engineering", "institution": "Nnamdi Azikiwe University (UNIZIK)"}], "experience": [{"dates": "Jan 2024 - Present", "title": "Full Stack Developer", "bullets": ["Designed and implemented robust backend services and data structures for a comprehensive school management system, optimizing data flow and integrity.", "Engineered and optimized scalable PostgreSQL database schemas, ensuring data integrity, efficient querying, and robust data management for student and faculty portals.", "Developed secure API integrations to facilitate data exchange and constructed admin dashboards for real-time data monitoring and reporting."], "company": "Cyberpurview", "location": "Awka, Nigeria"}, {"dates": "Mar 2023 - Present", "title": "Game & Engine Developer", "bullets": ["Applied principles of data structures and algorithms in game development, analyzing performance metrics to optimize user experience across multiple platforms.", "Developed and optimized networking protocols, managing real-time data transmission and synchronization for multiplayer interactions.", "Utilized Python for data transformation and algorithmic processing (solfa-to-MIDI conversion), demonstrating ability to manipulate and integrate complex data formats."], "company": "Independent Studio", "location": "Awka, Nigeria"}], "personalInfo": {"name": "Anthony Okonkwo", "role": "Data Analyst", "email": "tonystark@cyberpurview.com", "phone": "+234 800 000 0000", "location": "Awka, Nigeria"}}
268b18de-5392-4ea5-b576-cdeab78b0583	11111111-1111-1111-1111-111111111111	IT Audit	91	0	{"Information Security","Risk Management",Compliance,"System Architecture","Database Management","Network Security",PostgreSQL,Linux,Python,"API Security",SDLC,"Project Management","Data Governance","Access Control","Audit Methodologies"}	{"skills": ["Information Security", "Risk Management", "Compliance", "System Architecture", "Database Management", "Network Security", "PostgreSQL", "Linux", "Python", "API Security", "SDLC", "Project Management", "Data Governance", "Access Control", "Audit Methodologies"], "summary": "Highly analytical and detail-oriented Full Stack Developer with a strong foundation in system architecture, secure database design, and API security. Adept at identifying and mitigating risks within complex technical environments, and passionate about ensuring compliance and operational integrity. Eager to leverage comprehensive software development lifecycle experience and robust problem-solving skills to contribute effectively in an IT Audit role.", "education": [{"dates": "2022 - Expected 2027", "degree": "B.Eng. Mechanical Engineering", "institution": "Nnamdi Azikiwe University (UNIZIK)"}], "experience": [{"dates": "Jan 2024 - Present", "title": "Full Stack Developer", "bullets": ["Designed and implemented robust system architectures for critical business applications, ensuring scalability, data integrity, and adherence to security best practices.", "Developed and optimized secure, scalable PostgreSQL database schemas, focusing on data governance, access control, and audit trail capabilities.", "Engineered secure API integrations and authentication mechanisms, performing risk assessments and ensuring compliance with industry security standards and internal policies."], "company": "Cyberpurview", "location": "Awka, Nigeria"}, {"dates": "Mar 2023 - Present", "title": "Game & Engine Developer", "bullets": ["Managed end-to-end software development lifecycle (SDLC) for multi-platform applications, including requirements gathering, design documentation, and deployment strategies.", "Analyzed, designed, and secured networking protocols for real-time multiplayer systems, identifying and mitigating potential vulnerabilities.", "Utilized Python for scripting and automation, demonstrating analytical prowess in complex data processing and system integration tasks."], "company": "Independent Studio", "location": "Awka, Nigeria"}], "personalInfo": {"name": "Anthony Okonkwo", "role": "IT Audit Professional", "email": "tonystark@cyberpurview.com", "phone": "+234 800 000 0000", "location": "Awka, Nigeria"}}
6ea71af9-6fed-45ca-9aa7-7155da57d9cf	11111111-1111-1111-1111-111111111111	Data Analyst	99	0	{Python,PostgreSQL,SQL,"Data Analysis","Database Design","Data Modeling",ETL,Reporting,"Problem Solving","Analytical Skills",Linux,Node.js,NestJS,Next.js,TypeScript}	{"skills": ["Python", "PostgreSQL", "SQL", "Data Analysis", "Database Design", "Data Modeling", "ETL", "Reporting", "Problem Solving", "Analytical Skills", "Linux", "Node.js", "NestJS", "Next.js", "TypeScript"], "summary": "Highly motivated and detail-oriented individual with a strong foundation in full-stack development and robust problem-solving skills, eager to transition into a Data Analyst role. Proficient in Python and PostgreSQL, with experience in designing scalable database schemas, managing complex data, and implementing data-driven solutions. Adept at transforming raw data into actionable insights and committed to leveraging analytical abilities to support strategic decision-making and reporting.", "education": [{"dates": "2022 - Expected 2027", "degree": "B.Eng. Mechanical Engineering", "institution": "Nnamdi Azikiwe University (UNIZIK)"}], "experience": [{"dates": "Jan 2024 - Present", "title": "Full Stack Developer", "bullets": ["Designed and optimized scalable PostgreSQL database schemas, ensuring data integrity and efficiency for student and faculty portals, supporting future data analysis initiatives.", "Developed robust backend services with NestJS, facilitating data processing and secure API integrations critical for data management within a comprehensive school management system.", "Contributed to system architecture, focusing on data structure optimization and the implementation of dashboards for administrative data reporting."], "company": "Cyberpurview", "location": "Awka, Nigeria"}, {"dates": "Mar 2023 - Present", "title": "Game & Engine Developer", "bullets": ["Leveraged Python for data manipulation and transformation (solfa-to-MIDI conversion), demonstrating proficiency in scripting for complex data challenges.", "Engineered and troubleshooted complex systems, applying analytical and problem-solving skills to optimize performance and resolve technical issues.", "Managed and integrated diverse digital assets, ensuring data consistency and accuracy across multiple platforms (PC, Android) in a development environment."], "company": "Independent Studio", "location": "Awka, Nigeria"}], "personalInfo": {"name": "Anthony Okonkwo", "role": "Data Analyst", "email": "tonystark@cyberpurview.com", "phone": "+234 800 000 0000", "location": "Awka, Nigeria"}}
\.


--
-- Data for Name: specialists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.specialists (id, name, applications, interview_rate, status) FROM stdin;
\.


--
-- Data for Name: system_health; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_health (id, metric, value, status, icon_name) FROM stdin;
1	API Latency	124ms	healthy	Zap
2	DB Load	14%	healthy	Database
\.


--
-- Name: analytics_application_trend_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.analytics_application_trend_id_seq', 3, true);


--
-- Name: analytics_kpi_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.analytics_kpi_id_seq', 1, true);


--
-- Name: analytics_status_distribution_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.analytics_status_distribution_id_seq', 3, true);


--
-- Name: plan_distribution_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.plan_distribution_id_seq', 3, true);


--
-- Name: specialists_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.specialists_id_seq', 1, false);


--
-- Name: system_health_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_health_id_seq', 2, true);


--
-- Name: resumes PK_9c8677802096d6baece48429d2e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT "PK_9c8677802096d6baece48429d2e" PRIMARY KEY (id);


--
-- Name: application_records PK_dc535a0f19b86ac6fab3a43cb59; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_records
    ADD CONSTRAINT "PK_dc535a0f19b86ac6fab3a43cb59" PRIMARY KEY (id);


--
-- Name: clients PK_f1ab7cf3a5714dbc6bb4e1c28a4; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY (id);


--
-- Name: analytics_application_trend analytics_application_trend_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_application_trend
    ADD CONSTRAINT analytics_application_trend_pkey PRIMARY KEY (id);


--
-- Name: analytics_kpi analytics_kpi_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_kpi
    ADD CONSTRAINT analytics_kpi_pkey PRIMARY KEY (id);


--
-- Name: analytics_status_distribution analytics_status_distribution_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_status_distribution
    ADD CONSTRAINT analytics_status_distribution_pkey PRIMARY KEY (id);


--
-- Name: applications_list applications_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications_list
    ADD CONSTRAINT applications_list_pkey PRIMARY KEY (id);


--
-- Name: plan_distribution plan_distribution_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_distribution
    ADD CONSTRAINT plan_distribution_pkey PRIMARY KEY (id);


--
-- Name: specialists specialists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specialists
    ADD CONSTRAINT specialists_pkey PRIMARY KEY (id);


--
-- Name: system_health system_health_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_health
    ADD CONSTRAINT system_health_pkey PRIMARY KEY (id);


--
-- Name: application_records FK_c26cc15d178fc33b9509dcc2956; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_records
    ADD CONSTRAINT "FK_c26cc15d178fc33b9509dcc2956" FOREIGN KEY ("clientId") REFERENCES public.clients(id);


--
-- Name: resumes FK_dce6e1ce26d348e602f56fa6363; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT "FK_dce6e1ce26d348e602f56fa6363" FOREIGN KEY (user_id) REFERENCES public.clients(id);


--
-- Name: application_records FK_e3e7f56ecbf935a7080aad2cc03; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_records
    ADD CONSTRAINT "FK_e3e7f56ecbf935a7080aad2cc03" FOREIGN KEY ("resumeId") REFERENCES public.resumes(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TABLE analytics_application_trend; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.analytics_application_trend TO anon;
GRANT ALL ON TABLE public.analytics_application_trend TO authenticated;
GRANT ALL ON TABLE public.analytics_application_trend TO service_role;


--
-- Name: SEQUENCE analytics_application_trend_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.analytics_application_trend_id_seq TO anon;
GRANT ALL ON SEQUENCE public.analytics_application_trend_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.analytics_application_trend_id_seq TO service_role;


--
-- Name: TABLE analytics_kpi; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.analytics_kpi TO anon;
GRANT ALL ON TABLE public.analytics_kpi TO authenticated;
GRANT ALL ON TABLE public.analytics_kpi TO service_role;


--
-- Name: SEQUENCE analytics_kpi_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.analytics_kpi_id_seq TO anon;
GRANT ALL ON SEQUENCE public.analytics_kpi_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.analytics_kpi_id_seq TO service_role;


--
-- Name: TABLE analytics_status_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.analytics_status_distribution TO anon;
GRANT ALL ON TABLE public.analytics_status_distribution TO authenticated;
GRANT ALL ON TABLE public.analytics_status_distribution TO service_role;


--
-- Name: SEQUENCE analytics_status_distribution_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.analytics_status_distribution_id_seq TO anon;
GRANT ALL ON SEQUENCE public.analytics_status_distribution_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.analytics_status_distribution_id_seq TO service_role;


--
-- Name: TABLE application_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.application_records TO anon;
GRANT ALL ON TABLE public.application_records TO authenticated;
GRANT ALL ON TABLE public.application_records TO service_role;


--
-- Name: TABLE applications_list; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.applications_list TO anon;
GRANT ALL ON TABLE public.applications_list TO authenticated;
GRANT ALL ON TABLE public.applications_list TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: TABLE plan_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.plan_distribution TO anon;
GRANT ALL ON TABLE public.plan_distribution TO authenticated;
GRANT ALL ON TABLE public.plan_distribution TO service_role;


--
-- Name: SEQUENCE plan_distribution_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.plan_distribution_id_seq TO anon;
GRANT ALL ON SEQUENCE public.plan_distribution_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.plan_distribution_id_seq TO service_role;


--
-- Name: TABLE resumes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.resumes TO anon;
GRANT ALL ON TABLE public.resumes TO authenticated;
GRANT ALL ON TABLE public.resumes TO service_role;


--
-- Name: TABLE specialists; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.specialists TO anon;
GRANT ALL ON TABLE public.specialists TO authenticated;
GRANT ALL ON TABLE public.specialists TO service_role;


--
-- Name: SEQUENCE specialists_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.specialists_id_seq TO anon;
GRANT ALL ON SEQUENCE public.specialists_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.specialists_id_seq TO service_role;


--
-- Name: TABLE system_health; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_health TO anon;
GRANT ALL ON TABLE public.system_health TO authenticated;
GRANT ALL ON TABLE public.system_health TO service_role;


--
-- Name: SEQUENCE system_health_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.system_health_id_seq TO anon;
GRANT ALL ON SEQUENCE public.system_health_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.system_health_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict YVZLg1fGiT0aMErZmnVf17FksELL9aoDM0dwU2YZE6GVaYYSR1YEtfrdJ5EWKhB

