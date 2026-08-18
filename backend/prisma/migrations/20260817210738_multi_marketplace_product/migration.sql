/*
  Warnings:

  - You are about to drop the column `productId` on the `PriceHistory` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `currentPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `lastCheckedAt` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `lowestObservedPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `marketplaceId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `previousPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `lastCheckedAt` on the `TrackedProduct` table. All the data in the column will be lost.
  - Added the required column `listingId` to the `PriceHistory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PriceHistory" DROP CONSTRAINT "PriceHistory_productId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_marketplaceId_fkey";

-- DropIndex
DROP INDEX "PriceHistory_productId_checkedAt_idx";

-- DropIndex
DROP INDEX "Product_marketplaceId_externalId_key";

-- DropIndex
DROP INDEX "Product_marketplaceId_idx";

-- AlterTable
ALTER TABLE "PriceHistory" DROP COLUMN "productId",
ADD COLUMN     "listingId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "currency",
DROP COLUMN "currentPrice",
DROP COLUMN "externalId",
DROP COLUMN "imageUrl",
DROP COLUMN "lastCheckedAt",
DROP COLUMN "lowestObservedPrice",
DROP COLUMN "marketplaceId",
DROP COLUMN "previousPrice",
DROP COLUMN "url";

-- AlterTable
ALTER TABLE "TrackedProduct" DROP COLUMN "lastCheckedAt";

-- CreateTable
CREATE TABLE "ProductListing" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "currentPrice" DECIMAL(12,2) NOT NULL,
    "previousPrice" DECIMAL(12,2),
    "lowestObservedPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,

    CONSTRAINT "ProductListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductListing_productId_idx" ON "ProductListing"("productId");

-- CreateIndex
CREATE INDEX "ProductListing_marketplaceId_idx" ON "ProductListing"("marketplaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductListing_marketplaceId_externalId_key" ON "ProductListing"("marketplaceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductListing_productId_marketplaceId_key" ON "ProductListing"("productId", "marketplaceId");

-- CreateIndex
CREATE INDEX "PriceHistory_listingId_checkedAt_idx" ON "PriceHistory"("listingId", "checkedAt");

-- AddForeignKey
ALTER TABLE "ProductListing" ADD CONSTRAINT "ProductListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductListing" ADD CONSTRAINT "ProductListing_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ProductListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
