-- =====================================================
-- Active Supabase Realtime sur les tables métier (charte règle 2 :
-- Realtime + optimistic, zéro actualisation).
--
-- REPLICA IDENTITY FULL : nécessaire pour que les events UPDATE/DELETE
-- portent toutes les colonnes (dont company_id, utilisé pour le filtrage
-- côté client) et pour que les filtres de publication s'appliquent.
--
-- ⚠️ Ne JAMAIS ajouter user_settings à la publication (colonnes secrètes).
-- =====================================================

ALTER TABLE companies     REPLICA IDENTITY FULL;
ALTER TABLE clients       REPLICA IDENTITY FULL;
ALTER TABLE invoices      REPLICA IDENTITY FULL;
ALTER TABLE invoice_items REPLICA IDENTITY FULL;
ALTER TABLE quotes        REPLICA IDENTITY FULL;
ALTER TABLE quote_items   REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE
  companies, clients, invoices, invoice_items, quotes, quote_items, conversations;
