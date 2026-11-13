-- CreateTable
CREATE TABLE "BatchDirectors" (
    "churchId" TEXT NOT NULL,
    "directorIds" TEXT[],
    "lastDirectorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchDirectors_pkey" PRIMARY KEY ("churchId")
);

-- AddForeignKey
ALTER TABLE "BatchDirectors" ADD CONSTRAINT "BatchDirectors_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
