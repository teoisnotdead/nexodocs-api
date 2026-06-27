-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'SUBMITTED', 'IN_REVIEW', 'OBSERVED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "checklistId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" TIMESTAMP(3),
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "assignedClientContactId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRequest_organizationId_idx" ON "DocumentRequest"("organizationId");

-- CreateIndex
CREATE INDEX "DocumentRequest_workspaceId_idx" ON "DocumentRequest"("workspaceId");

-- CreateIndex
CREATE INDEX "DocumentRequest_checklistId_idx" ON "DocumentRequest"("checklistId");

-- CreateIndex
CREATE INDEX "DocumentRequest_assignedClientContactId_idx" ON "DocumentRequest"("assignedClientContactId");

-- CreateIndex
CREATE INDEX "DocumentRequest_createdById_idx" ON "DocumentRequest"("createdById");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- CreateIndex
CREATE INDEX "DocumentRequest_dueDate_idx" ON "DocumentRequest"("dueDate");

-- CreateIndex
CREATE INDEX "DocumentRequest_createdAt_idx" ON "DocumentRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_assignedClientContactId_fkey" FOREIGN KEY ("assignedClientContactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
