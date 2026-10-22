-- Re-key subject-scoped rows stored under an alias (e.g. 'crk') to the canonical key
-- now produced by subjectIdentity(). Rows whose canonical counterpart already exists
-- under the same unique scope are left untouched (no merge, no data loss) and can
-- be reconciled by an administrator.
CREATE TEMP TABLE subject_aliases (alias text PRIMARY KEY, canonical text NOT NULL);
INSERT INTO subject_aliases (alias, canonical) VALUES
  ('english language', 'english'),
  ('use of english', 'english'),
  ('math', 'mathematics'),
  ('maths', 'mathematics'),
  ('general mathematics', 'mathematics'),
  ('further maths', 'further mathematics'),
  ('further math', 'further mathematics'),
  ('christian religious knowledge', 'christian religious studies'),
  ('crs', 'christian religious studies'),
  ('crk', 'christian religious studies'),
  ('islamic religious studies', 'islamic studies'),
  ('islamic religious knowledge', 'islamic studies'),
  ('irs', 'islamic studies'),
  ('irk', 'islamic studies'),
  ('literature-in-english', 'literature in english'),
  ('lit in english', 'literature in english'),
  ('lit-in-english', 'literature in english'),
  ('literature', 'literature in english'),
  ('agric', 'agricultural science'),
  ('agric science', 'agricultural science'),
  ('agric. science', 'agricultural science'),
  ('econs', 'economics'),
  ('govt', 'government'),
  ('geog', 'geography'),
  ('bio', 'biology'),
  ('chem', 'chemistry'),
  ('phy', 'physics');

UPDATE "exam_goal_subjects" s SET "subjectKey" = a.canonical FROM subject_aliases a
WHERE s."subjectKey" = a.alias
  AND NOT EXISTS (SELECT 1 FROM "exam_goal_subjects" x WHERE x."goalId" = s."goalId" AND x."subjectKey" = a.canonical);

UPDATE "exam_materials" m SET "subjectKey" = a.canonical FROM subject_aliases a WHERE m."subjectKey" = a.alias;

UPDATE "exam_bank_questions" q SET "subjectKey" = a.canonical FROM subject_aliases a
WHERE q."subjectKey" = a.alias
  AND NOT EXISTS (SELECT 1 FROM "exam_bank_questions" x WHERE x."exam" = q."exam" AND x."subjectKey" = a.canonical AND x."fingerprint" = q."fingerprint");

UPDATE "exam_syllabuses" y SET "subjectKey" = a.canonical FROM subject_aliases a
WHERE y."subjectKey" = a.alias
  AND NOT EXISTS (SELECT 1 FROM "exam_syllabuses" x WHERE x."exam" = y."exam" AND x."year" = y."year" AND x."subjectKey" = a.canonical AND x."version" = y."version");

UPDATE "waec_paper_templates" p SET "subjectKey" = a.canonical FROM subject_aliases a
WHERE p."subjectKey" = a.alias
  AND NOT EXISTS (SELECT 1 FROM "waec_paper_templates" x WHERE x."year" = p."year" AND x."series" = p."series" AND x."subjectKey" = a.canonical AND x."paperCode" = p."paperCode");

UPDATE "courses" c SET "examSubjectKey" = a.canonical FROM subject_aliases a
WHERE c."examSubjectKey" = a.alias
  AND NOT EXISTS (SELECT 1 FROM "courses" x WHERE x."ownerId" = c."ownerId" AND x."examSubjectKey" = a.canonical);

DROP TABLE subject_aliases;
