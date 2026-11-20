-- Alamat web per circle / rumah usaha (bloom.domain-anda.com dst). Diisi manual setelah nama alamat disepakati.
ALTER TABLE "Circle" ADD COLUMN "slug" TEXT;
ALTER TABLE "RumahUsaha" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Circle_slug_key" ON "Circle"("slug");
CREATE UNIQUE INDEX "RumahUsaha_slug_key" ON "RumahUsaha"("slug");
