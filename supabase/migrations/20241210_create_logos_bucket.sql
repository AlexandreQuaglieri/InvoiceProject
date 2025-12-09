-- Créer le bucket logos s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Politique pour permettre aux utilisateurs authentifiés d'uploader leur logo
CREATE POLICY "Users can upload their company logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.companies WHERE user_id = auth.uid()
  )
);

-- Politique pour permettre aux utilisateurs de mettre à jour leur logo
CREATE POLICY "Users can update their company logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.companies WHERE user_id = auth.uid()
  )
);

-- Politique pour permettre aux utilisateurs de supprimer leur logo
CREATE POLICY "Users can delete their company logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.companies WHERE user_id = auth.uid()
  )
);

-- Politique pour permettre à tout le monde de voir les logos (public)
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');
