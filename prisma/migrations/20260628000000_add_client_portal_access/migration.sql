-- AlterEnum
ALTER TYPE "ActivityActorType" ADD VALUE IF NOT EXISTS 'CLIENT_CONTACT';

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "Document" ADD COLUMN "uploadedByClientContactId" TEXT;

-- AlterTable
ALTER TABLE "DocumentVersion" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "DocumentVersion" ADD COLUMN "uploadedByClientContactId" TEXT;

-- AlterTable
ALTER TABLE "FileAsset" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "FileAsset" ADD COLUMN "uploadedByClientContactId" TEXT;

-- CreateTable
CREATE TABLE "ClientPortalAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientContactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "codeExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccess_tokenHash_key" ON "ClientPortalAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_organizationId_idx" ON "ClientPortalAccess"("organizationId");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_workspaceId_idx" ON "ClientPortalAccess"("workspaceId");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_clientId_idx" ON "ClientPortalAccess"("clientId");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_clientContactId_idx" ON "ClientPortalAccess"("clientContactId");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_expiresAt_idx" ON "ClientPortalAccess"("expiresAt");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_revokedAt_idx" ON "ClientPortalAccess"("revokedAt");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_createdById_idx" ON "ClientPortalAccess"("createdById");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_createdAt_idx" ON "ClientPortalAccess"("createdAt");

-- CreateIndex
CREATE INDEX "Document_uploadedByClientContactId_idx" ON "Document"("uploadedByClientContactId");

-- CreateIndex
CREATE INDEX "DocumentVersion_uploadedByClientContactId_idx" ON "DocumentVersion"("uploadedByClientContactId");

-- CreateIndex
CREATE INDEX "FileAsset_uploadedByClientContactId_idx" ON "FileAsset"("uploadedByClientContactId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByClientContactId_fkey" FOREIGN KEY ("uploadedByClientContactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedByClientContactId_fkey" FOREIGN KEY ("uploadedByClientContactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedByClientContactId_fkey" FOREIGN KEY ("uploadedByClientContactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
