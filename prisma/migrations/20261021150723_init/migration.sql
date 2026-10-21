-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('DEALER', 'COMPANY');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('ORG_ADMIN', 'ORG_STAFF');

-- CreateEnum
CREATE TYPE "PreviousRegistration" AS ENUM ('NEVER_REGISTERED', 'SWISS_CANTON', 'ABROAD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PlateSituation" AS ENUM ('EXISTING_PLATES_AVAILABLE', 'EXISTING_PLATES_UNKNOWN', 'NEW_PLATES_REQUIRED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('VEHICLE_CHANGE_WITH_PLATES', 'NEW_VEHICLE_NEW_PLATES', 'USED_VEHICLE_PURCHASE', 'MANUAL_CLASSIFICATION');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('SALE_CREATED', 'INVITED', 'PURCHASE_CONFIRMED', 'PREPARATION', 'REVIEW', 'READY_FOR_SUBMISSION', 'SUBMITTED', 'AUTHORITY_PROCESSING', 'PLATES_AND_ORIGINALS', 'HANDOVER_RELEASABLE', 'HANDED_OVER', 'CLOSED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RulesetStatus" AS ENUM ('VERIFIED', 'PARTIALLY_VERIFIED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('DOCUMENT', 'DATA', 'INSURANCE', 'PLATE', 'ORIGINAL', 'INSPECTION', 'AUTHORITY', 'CONSENT');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('OPEN', 'SATISFIED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "RuleVerification" AS ENUM ('VERIFIED_RULE', 'UNVERIFIED_RULE');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('IDENTITY', 'VEHICLE_REGISTRATION', 'INSPECTION_REPORT_13_20A', 'PURCHASE_CONTRACT', 'POWER_OF_ATTORNEY', 'RESIDENCE_PROOF', 'COMMERCIAL_REGISTER', 'INSURANCE_EVIDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('NOT_SCANNED', 'CLEAN', 'INFECTED');

-- CreateEnum
CREATE TYPE "FieldStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'CORRECTED');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('NOT_STARTED', 'REQUESTED', 'IN_PROGRESS', 'CONFIRMED', 'NOT_VERIFIED', 'PROBLEM');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PREPARED', 'QUEUED_MANUAL', 'SUBMITTED', 'ACKNOWLEDGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuthorityResponseKind" AS ENUM ('ACKNOWLEDGED', 'MORE_DOCUMENTS_REQUESTED', 'REGISTRATION_CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('MANUAL_CHECK', 'DATA_CONFLICT', 'EXCEPTION', 'DEAD_LETTER', 'OVERRIDE_REQUEST');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('REQUEST_INSURANCE', 'PREPARE_AUTHORITY_SUBMISSION');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('SYSTEM', 'CUSTOMER', 'DEALER', 'OPERATOR', 'PARTNER_WEBHOOK', 'SIMULATION');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PROCESSED', 'IGNORED_DUPLICATE', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('NOT_REQUESTED', 'LOGGED_ONLY', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "type" "OrgType" NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "canton" TEXT NOT NULL,
    "uid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrgRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phone" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "canton" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "vin" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "isImport" BOOLEAN NOT NULL DEFAULT false,
    "firstRegistrationDate" DATE,
    "mileageKm" INTEGER,
    "previousRegistration" "PreviousRegistration" NOT NULL DEFAULT 'UNKNOWN',
    "previousCanton" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSale" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerUserId" UUID,
    "isCompanyBuyer" BOOLEAN NOT NULL DEFAULT false,
    "canton" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "plannedHandoverDate" DATE,
    "priceChf" INTEGER,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseConfirmation" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "confirmedByUserId" UUID NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmationKind" TEXT NOT NULL DEFAULT 'PROCESS_CONFIRMATION',
    "textVersion" TEXT NOT NULL,
    "dataConsent" BOOLEAN NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "PurchaseConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationCase" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "customerUserId" UUID,
    "canton" TEXT NOT NULL,
    "caseType" "CaseType" NOT NULL DEFAULT 'MANUAL_CLASSIFICATION',
    "plateSituation" "PlateSituation" NOT NULL DEFAULT 'EXISTING_PLATES_UNKNOWN',
    "status" "CaseStatus" NOT NULL DEFAULT 'SALE_CREATED',
    "resumeStatus" "CaseStatus",
    "rulesetId" UUID,
    "rulesetVersion" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "nextAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "RegistrationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CantonRuleset" (
    "id" UUID NOT NULL,
    "canton" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RulesetStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "sourceUrls" JSONB NOT NULL,
    "sourceCheckedAt" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3) NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CantonRuleset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRequirement" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL,
    "documentKind" "DocumentKind",
    "status" "RequirementStatus" NOT NULL DEFAULT 'OPEN',
    "verification" "RuleVerification" NOT NULL,
    "sourceRef" TEXT,
    "note" TEXT,
    "satisfiedAt" TIMESTAMP(3),
    "satisfiedBy" UUID,
    "satisfiedVia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "caseId" UUID,
    "vehicleId" UUID,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "extractor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtractionField" (
    "id" UUID NOT NULL,
    "extractionId" UUID NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "suggestedValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "confirmedValue" TEXT,
    "status" "FieldStatus" NOT NULL DEFAULT 'SUGGESTED',
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtractionField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceProvider" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceRequest" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "providerKey" TEXT NOT NULL,
    "status" "InsuranceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "externalReference" TEXT,
    "evidenceDocumentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceStatusEvent" (
    "id" UUID NOT NULL,
    "insuranceRequestId" UUID NOT NULL,
    "fromStatus" "InsuranceStatus",
    "toStatus" "InsuranceStatus" NOT NULL,
    "source" "EventSource" NOT NULL,
    "externalEventId" TEXT,
    "actorUserId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthoritySubmission" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PREPARED',
    "channel" TEXT NOT NULL,
    "preparedById" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthoritySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorityResponse" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "submissionId" UUID,
    "kind" "AuthorityResponseKind" NOT NULL,
    "source" "EventSource" NOT NULL,
    "reference" TEXT,
    "externalEventId" TEXT,
    "recordedById" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorityResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporaryAuthorization" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "documentId" UUID,
    "source" "EventSource" NOT NULL,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemporaryAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "kind" "ReviewKind" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "openedBy" "EventSource" NOT NULL,
    "resolvedById" UUID,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTask" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" "CaseStatus",
    "toStatus" "CaseStatus",
    "source" "EventSource" NOT NULL,
    "actorUserId" UUID,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "caseId" UUID,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "emailStatus" "EmailStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "organizationId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_uid_key" ON "Organization"("uid");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_organizationId_vin_key" ON "Vehicle"("organizationId", "vin");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSale_inviteTokenHash_key" ON "VehicleSale"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "VehicleSale_organizationId_idx" ON "VehicleSale"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseConfirmation_saleId_key" ON "PurchaseConfirmation"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCase_saleId_key" ON "RegistrationCase"("saleId");

-- CreateIndex
CREATE INDEX "RegistrationCase_organizationId_status_idx" ON "RegistrationCase"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RegistrationCase_customerUserId_idx" ON "RegistrationCase"("customerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CantonRuleset_canton_version_key" ON "CantonRuleset"("canton", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRequirement_caseId_ruleKey_key" ON "CaseRequirement"("caseId", "ruleKey");

-- CreateIndex
CREATE INDEX "Document_caseId_idx" ON "Document"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_storageKey_key" ON "DocumentVersion"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtraction_documentVersionId_key" ON "DocumentExtraction"("documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtractionField_extractionId_fieldKey_key" ON "DocumentExtractionField"("extractionId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceProvider_adapterKey_key" ON "InsuranceProvider"("adapterKey");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceRequest_caseId_key" ON "InsuranceRequest"("caseId");

-- CreateIndex
CREATE INDEX "InsuranceStatusEvent_insuranceRequestId_idx" ON "InsuranceStatusEvent"("insuranceRequestId");

-- CreateIndex
CREATE INDEX "AuthoritySubmission_caseId_idx" ON "AuthoritySubmission"("caseId");

-- CreateIndex
CREATE INDEX "AuthorityResponse_caseId_idx" ON "AuthorityResponse"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorityResponse_source_externalEventId_key" ON "AuthorityResponse"("source", "externalEventId");

-- CreateIndex
CREATE INDEX "TemporaryAuthorization_caseId_idx" ON "TemporaryAuthorization"("caseId");

-- CreateIndex
CREATE INDEX "ReviewItem_caseId_status_idx" ON "ReviewItem"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTask_idempotencyKey_key" ON "WorkflowTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkflowTask_status_nextRunAt_idx" ON "WorkflowTask"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "WorkflowTask_caseId_idx" ON "WorkflowTask"("caseId");

-- CreateIndex
CREATE INDEX "WorkflowEvent_caseId_createdAt_idx" ON "WorkflowEvent"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalEventId_key" ON "WebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSale" ADD CONSTRAINT "VehicleSale_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseConfirmation" ADD CONSTRAINT "PurchaseConfirmation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "VehicleSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCase" ADD CONSTRAINT "RegistrationCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCase" ADD CONSTRAINT "RegistrationCase_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "VehicleSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCase" ADD CONSTRAINT "RegistrationCase_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCase" ADD CONSTRAINT "RegistrationCase_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "CantonRuleset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRequirement" ADD CONSTRAINT "CaseRequirement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractionField" ADD CONSTRAINT "DocumentExtractionField_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "DocumentExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceRequest" ADD CONSTRAINT "InsuranceRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceStatusEvent" ADD CONSTRAINT "InsuranceStatusEvent_insuranceRequestId_fkey" FOREIGN KEY ("insuranceRequestId") REFERENCES "InsuranceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthoritySubmission" ADD CONSTRAINT "AuthoritySubmission_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityResponse" ADD CONSTRAINT "AuthorityResponse_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityResponse" ADD CONSTRAINT "AuthorityResponse_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AuthoritySubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporaryAuthorization" ADD CONSTRAINT "TemporaryAuthorization_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegistrationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
