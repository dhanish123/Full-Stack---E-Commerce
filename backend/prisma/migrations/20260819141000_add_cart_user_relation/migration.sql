-- Add ownership to existing cart items before enforcing the required relation.
ALTER TABLE "CartItem" ADD COLUMN "userId" INTEGER;

UPDATE "CartItem"
SET "userId" = (SELECT "id" FROM "User" ORDER BY "id" LIMIT 1)
WHERE "userId" IS NULL;

ALTER TABLE "CartItem" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_productId_userId_key"
  ON "CartItem"("productId", "userId");
