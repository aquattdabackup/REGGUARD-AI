-- Run AFTER Alembic 0001 in the Supabase SQL editor as postgres.
-- API uses a trusted PostgreSQL service connection. Browser roles have SELECT only.
-- Membership creation/role changes are API-controlled; no self-grant policy exists.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE OR REPLACE FUNCTION private.is_member(org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m
                 WHERE m.organization_id = org AND m.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION private.is_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_member(uuid) TO authenticated;

ALTER TABLE public.memberships ADD CONSTRAINT memberships_auth_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('owner','admin','analyst','reviewer','viewer'));
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_read ON public.memberships FOR SELECT TO authenticated USING (private.is_member(organization_id));
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_read ON public.organizations FOR SELECT TO authenticated USING (private.is_member(id));
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY policies_read ON public.policies FOR SELECT TO authenticated USING (true);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['cases','documents','check_runs','source_snapshots','findings','reviews','reports','chain_anchors','audit_events','background_jobs','ai_usage'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (private.is_member(organization_id))', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_sessions, public.wallet_nonces FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.memberships, public.organizations, public.policies FROM anon, authenticated;
GRANT SELECT ON public.memberships, public.organizations, public.policies TO authenticated;
-- Keep salts and signed transactions behind the authorized API, not the Supabase REST API.
REVOKE ALL ON public.reports, public.chain_anchors FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence','evidence',false,10485760,ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET public=false;
CREATE POLICY private_evidence_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'evidence' AND private.is_member((storage.foldername(name))[1]::uuid));
-- Upload/signing is server-only and checks organization plus role before using service credentials.

CREATE OR REPLACE FUNCTION private.reject_final_report_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.finalized_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Finalized reports are immutable'; END IF;
    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'Finalized reports are immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finalized_report_immutable BEFORE UPDATE OR DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION private.reject_final_report_mutation();
