ALTER TABLE "Order" DROP COLUMN "razorpayOrderId",
DROP COLUMN "razorpayPaymentId",
DROP COLUMN "razorpaySignature";

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PLACED';
