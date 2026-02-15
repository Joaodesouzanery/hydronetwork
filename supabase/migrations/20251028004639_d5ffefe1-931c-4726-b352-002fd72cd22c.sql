-- Criar bucket de storage para fotos de tarefas
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', false);

-- Políticas RLS para task-photos bucket
CREATE POLICY "Users can view task photos from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);

CREATE POLICY "Users can upload task photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);

CREATE POLICY "Users can delete their task photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);