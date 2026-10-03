-- Remove legacy CCCD verification and any CCCD document entry from seeker profiles.
ALTER TABLE "Recruiter" DROP COLUMN "cccdVerifiedAt";

UPDATE "SeekerProfile"
SET "documents" = COALESCE(
  (
    SELECT jsonb_agg(document)
    FROM jsonb_array_elements("documents") AS entries(document)
    WHERE document->>'key' IS DISTINCT FROM 'cccd'
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof("documents") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("documents") AS entries(document)
    WHERE document->>'key' = 'cccd'
  );

UPDATE "VerificationRequest"
SET "documents" = COALESCE(
  (
    SELECT jsonb_agg(document)
    FROM jsonb_array_elements("documents") AS entries(document)
    WHERE document->>'key' IS DISTINCT FROM 'cccd'
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof("documents") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("documents") AS entries(document)
    WHERE document->>'key' = 'cccd'
  );
