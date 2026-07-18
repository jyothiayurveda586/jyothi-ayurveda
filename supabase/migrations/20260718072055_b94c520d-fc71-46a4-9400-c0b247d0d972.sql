
-- admin_config: server-only. Revoke client grants and add explicit deny policy.
REVOKE ALL ON public.admin_config FROM anon, authenticated;
GRANT ALL ON public.admin_config TO service_role;
CREATE POLICY "Block all client access to admin_config"
  ON public.admin_config
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- sync_config: server-only.
REVOKE ALL ON public.sync_config FROM anon, authenticated;
GRANT ALL ON public.sync_config TO service_role;
CREATE POLICY "Block all client access to sync_config"
  ON public.sync_config
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- appointments: allow patients to update/cancel their own appointments.
CREATE POLICY "Patients update own appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients delete own appointments"
  ON public.appointments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = patient_id);

-- op_register: explicitly block client writes. Only service role (admin flows) may write.
CREATE POLICY "Block client writes to op_register"
  ON public.op_register
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Block client updates to op_register"
  ON public.op_register
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block client deletes from op_register"
  ON public.op_register
  AS RESTRICTIVE
  FOR DELETE
  TO anon, authenticated
  USING (false);
