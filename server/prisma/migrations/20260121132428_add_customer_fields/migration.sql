-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "region" TEXT,
ADD COLUMN     "religion" TEXT;

-- CreateIndex
CREATE INDEX "customers_region_idx" ON "customers"("region");
