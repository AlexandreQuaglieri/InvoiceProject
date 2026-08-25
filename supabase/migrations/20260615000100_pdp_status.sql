-- =====================================================
-- Statuts de transmission e-invoicing persistants (Phase 2, conformité 2026).
-- pdp_status = dernier code AFNOR connu (ex. 'fr:204', 'api:uploaded'),
-- synchronisé par polling (la PDP n'a pas de webhooks) : à la transmission,
-- à l'ouverture de la fiche facture, et par le cron pdp-sync.
-- Le détail/timeline reste lu à la demande auprès de la PDP.
-- =====================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pdp_status TEXT,
  ADD COLUMN IF NOT EXISTS pdp_status_text TEXT,
  ADD COLUMN IF NOT EXISTS pdp_status_at TIMESTAMPTZ;

-- Index partiel pour le cron : factures transmises (statuts encore ouverts filtrés côté requête).
CREATE INDEX IF NOT EXISTS idx_invoices_pdp_open
  ON invoices (company_id)
  WHERE pdp_deposit_id IS NOT NULL;
