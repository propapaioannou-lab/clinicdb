-- "Άλλο" becomes "Μη δυαδικό"; add trans man / trans woman (decided 11 Oct 2026).
ALTER TYPE "Sex" RENAME VALUE 'OTHER' TO 'NON_BINARY';
ALTER TYPE "Sex" ADD VALUE 'TRANS_MAN';
ALTER TYPE "Sex" ADD VALUE 'TRANS_WOMAN';
