-- Add the optional user relation introduced on Order.
ALTER TABLE "Order" ADD COLUMN "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
