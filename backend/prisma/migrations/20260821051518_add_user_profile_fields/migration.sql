-- DropIndex
DROP INDEX "Order_userId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "phone" TEXT;
