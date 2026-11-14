-- CreateTable
CREATE TABLE "ServicePreaching" (
    "serviceId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "preacherId" TEXT,
    "topic" TEXT NOT NULL DEFAULT '',
    "passages" TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePreaching_pkey" PRIMARY KEY ("serviceId"),
    CONSTRAINT "ServicePreaching_topic_check" CHECK (char_length("topic") <= 160),
    CONSTRAINT "ServicePreaching_passages_check" CHECK (cardinality("passages") <= 20),
    CONSTRAINT "ServicePreaching_notes_check" CHECK (char_length("notes") <= 4000)
);

-- CreateIndex
CREATE INDEX "ServicePreaching_churchId_preacherId_idx" ON "ServicePreaching"("churchId", "preacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePreaching_serviceId_churchId_key" ON "ServicePreaching"("serviceId", "churchId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_id_churchId_key" ON "Service"("id", "churchId");

-- AddForeignKey
ALTER TABLE "ServicePreaching" ADD CONSTRAINT "ServicePreaching_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePreaching" ADD CONSTRAINT "ServicePreaching_serviceId_churchId_fkey" FOREIGN KEY ("serviceId", "churchId") REFERENCES "Service"("id", "churchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePreaching" ADD CONSTRAINT "ServicePreaching_churchId_preacherId_fkey" FOREIGN KEY ("churchId", "preacherId") REFERENCES "ChurchPerson"("churchId", "personId") ON DELETE RESTRICT ON UPDATE CASCADE;
