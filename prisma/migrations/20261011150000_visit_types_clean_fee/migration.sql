-- 11 Oct 2026 (owner): consultation fee €100 by default; visit types = the clean list from
-- the approved design (old my-medical types are mapped at import, not copied).
UPDATE "ListItem" SET "defaultFeeCents" = 10000
  WHERE "kind" = 'VISIT_TYPE' AND "label" = 'Πρώτη επίσκεψη' AND "defaultFeeCents" IS NULL;

UPDATE "ListItem" SET "label" = 'Προεγχειρητική εκτίμηση' WHERE "kind" = 'VISIT_TYPE' AND "label" = 'ΠΡΟΕΓΧΕΙΡΗΤΙΚΗ ΕΚΤΙΜΗΣΗ';
UPDATE "ListItem" SET "label" = 'Επανέλεγχος' WHERE "kind" = 'VISIT_TYPE' AND "label" = 'Επανεξέταση';
UPDATE "ListItem" SET "label" = 'Μετεγχειρητικός' WHERE "kind" = 'VISIT_TYPE' AND "label" = 'Μετεγχειρητική';
-- Not in the design: hidden from new visits; visits that already use them keep them.
UPDATE "ListItem" SET "isActive" = false WHERE "kind" = 'VISIT_TYPE' AND "label" IN ('Αφαίρεση ραμμάτων', 'Μικροεπέμβαση');
UPDATE "ListItem" SET "sortOrder" = CASE "label"
    WHEN 'Πρώτη επίσκεψη' THEN 0 WHEN 'Προεγχειρητική εκτίμηση' THEN 1 WHEN 'Επανέλεγχος' THEN 2
    WHEN 'Μετεγχειρητικός' THEN 3 ELSE "sortOrder" END
  WHERE "kind" = 'VISIT_TYPE';
-- "Άλλο" for every company that has the surgery list.
INSERT INTO "ListItem" ("id", "companyId", "kind", "label", "sortOrder", "isActive", "chargeable", "createdAt")
SELECT 'vt_other_' || c."id", c."id", 'VISIT_TYPE', 'Άλλο', 4, true, false, CURRENT_TIMESTAMP
FROM "Company" c
WHERE c."code" = 'surgery'
  AND NOT EXISTS (SELECT 1 FROM "ListItem" l WHERE l."companyId" = c."id" AND l."kind" = 'VISIT_TYPE' AND l."label" = 'Άλλο');
