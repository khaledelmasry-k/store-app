-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "merchantNote" TEXT,
ADD COLUMN     "segment" TEXT NOT NULL DEFAULT '';
