-- CreateTable
CREATE TABLE "customer_products" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_products_customer_id_idx" ON "customer_products"("customer_id");

-- AddForeignKey
ALTER TABLE "customer_products" ADD CONSTRAINT "customer_products_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
