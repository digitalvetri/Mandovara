-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('OWNER', 'DESIGNER', 'SALES', 'MEASURE_EXEC', 'STORE', 'MAKE_SUPERVISOR', 'INSTALLER', 'ACCOUNTS', 'HR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProductFamily" AS ENUM ('CURTAIN_FABRIC', 'SHEER', 'LINING', 'BLIND', 'WALLPAPER', 'FLOORING', 'CARPET_ROLL', 'CARPET_TILE', 'UPHOLSTERY_FABRIC', 'FOAM_FILLING', 'VERTICAL_GARDEN', 'INTERIOR_FILM', 'MURAL', 'HARDWARE_TRACK', 'HARDWARE_ROD', 'MOTOR', 'ACCESSORY', 'SERVICE');

-- CreateEnum
CREATE TYPE "SellUnit" AS ENUM ('METRE', 'ROLL', 'SQFT', 'SQM', 'PIECE', 'SET', 'BOX', 'RUNNING_FT');

-- CreateEnum
CREATE TYPE "PatternMatch" AS ENUM ('FREE', 'STRAIGHT', 'OFFSET');

-- CreateEnum
CREATE TYPE "FabricRun" AS ENUM ('VERTICAL', 'RAILROADED');

-- CreateEnum
CREATE TYPE "HeadingType" AS ENUM ('EYELET', 'PINCH_PLEAT', 'PENCIL_PLEAT', 'RIPPLE_FOLD', 'TAB_TOP', 'ROD_POCKET');

-- CreateEnum
CREATE TYPE "MountType" AS ENUM ('INSIDE', 'OUTSIDE', 'CEILING');

-- CreateEnum
CREATE TYPE "OpeningType" AS ENUM ('WINDOW', 'DOOR', 'WALL', 'FLOOR', 'CEILING', 'FURNITURE', 'OTHER');

-- CreateEnum
CREATE TYPE "SurfaceType" AS ENUM ('WINDOW', 'WALL', 'FLOOR', 'CEILING', 'FURNITURE', 'GLASS');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WALK_IN', 'PHONE', 'WHATSAPP', 'WEBSITE', 'INSTAGRAM', 'ARCHITECT_REFERRAL', 'CLIENT_REFERRAL', 'EXHIBITION', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'MEASUREMENT_SCHEDULED', 'MEASURED', 'QUOTED', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('HOMEOWNER', 'ARCHITECT', 'INTERIOR_DESIGNER', 'BUILDER', 'COMMERCIAL', 'GOVERNMENT', 'DEALER');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('ENQUIRY', 'MEASUREMENT', 'QUOTATION', 'ORDERED', 'PROCUREMENT', 'MAKE', 'INSTALLATION', 'SNAGGING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeasurementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'REVISED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCUREMENT', 'MAKE', 'READY_TO_INSTALL', 'INSTALLING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('GRN_IN', 'ALLOCATE', 'ISSUE_TO_MAKE', 'ISSUE_TO_SITE', 'RETURN_TO_STOCK', 'SCRAP', 'ADJUSTMENT', 'SAMPLE_OUT', 'SAMPLE_IN');

-- CreateEnum
CREATE TYPE "MakeJobStatus" AS ENUM ('QUEUED', 'CUTTING', 'STITCHING', 'FINISHING', 'QC', 'READY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "InstallStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SnagStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('TAX', 'PROFORMA', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IrnStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'GENERATED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD');

-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('PENDING', 'CLEARED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('IN_LIBRARY', 'ISSUED', 'OVERDUE', 'RETURNED', 'LOST');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEK_OFF');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "MsgCategory" AS ENUM ('UTILITY', 'MARKETING', 'AUTHENTICATION', 'SERVICE');

-- CreateEnum
CREATE TYPE "MsgStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "addressLine" TEXT,
    "city" TEXT DEFAULT 'Coimbatore',
    "state" TEXT DEFAULT 'Tamil Nadu',
    "stateCode" TEXT NOT NULL DEFAULT '33',
    "pincode" TEXT DEFAULT '641002',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoKey" TEXT,
    "letterheadKey" TEXT,
    "fyStartMonth" INTEGER NOT NULL DEFAULT 4,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "stateCode" TEXT NOT NULL DEFAULT '33',
    "address" JSONB,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'MDV',

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "AppRole" NOT NULL,
    "branchIds" TEXT[],
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "doj" TIMESTAMP(3) NOT NULL,
    "salaryStructure" JSONB,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "vendorId" TEXT,
    "logoKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "ProductFamily" NOT NULL,
    "seasonYear" INTEGER,
    "catalogPdfKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "ProductFamily" NOT NULL,
    "rollWidthMm" DECIMAL(10,2),
    "rollLengthM" DECIMAL(10,3),
    "fabricWidthMm" DECIMAL(10,2),
    "patternRepeatMm" DECIMAL(10,2),
    "patternMatch" "PatternMatch" NOT NULL DEFAULT 'FREE',
    "railroadable" BOOLEAN NOT NULL DEFAULT false,
    "gsm" INTEGER,
    "thicknessMm" DECIMAL(6,2),
    "areaPerBoxSqft" DECIMAL(10,3),
    "tileSizeMm" TEXT,
    "specs" JSONB NOT NULL,
    "hsn" TEXT NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "searchVector" tsvector,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colourway" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "colourName" TEXT NOT NULL,
    "hex" TEXT,
    "imageKey" TEXT,
    "sellUnit" "SellUnit" NOT NULL,
    "moq" DECIMAL(10,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Colourway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Price" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "colourwayId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "clientId" TEXT,
    "amount" BIGINT NOT NULL,
    "minChargeSqft" DECIMAL(10,3),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "family" "ProductFamily" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "SellUnit" NOT NULL,
    "amount" BIGINT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleBook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "costValue" BIGINT NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'IN_LIBRARY',

    CONSTRAINT "SampleBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleIssue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sampleBookId" TEXT NOT NULL,
    "issuedToType" TEXT NOT NULL,
    "clientId" TEXT,
    "architectId" TEXT,
    "userId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "depositAmount" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "SampleIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "source" "LeadSource" NOT NULL,
    "architectId" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "siteAddress" JSONB,
    "requirement" TEXT,
    "familiesInterested" "ProductFamily"[],
    "budgetMin" BIGINT,
    "budgetMax" BIGINT,
    "ownerId" TEXT NOT NULL,
    "lostReason" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "convertedClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'HOMEOWNER',
    "gstin" TEXT,
    "pan" TEXT,
    "mobile" TEXT NOT NULL,
    "altMobile" TEXT,
    "email" TEXT,
    "billingAddress" JSONB NOT NULL,
    "priceTier" TEXT NOT NULL DEFAULT 'RETAIL',
    "creditLimit" BIGINT NOT NULL DEFAULT 0,
    "architectId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPerson" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContactPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Architect" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "address" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Architect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchitectCommission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "architectId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "baseAmount" BIGINT NOT NULL,
    "pct" DECIMAL(5,2) NOT NULL,
    "amount" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,

    CONSTRAINT "ArchitectCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "architectId" TEXT,
    "stage" "ProjectStage" NOT NULL DEFAULT 'ENQUIRY',
    "siteAddress" JSONB NOT NULL,
    "siteContactName" TEXT,
    "siteContactMobile" TEXT,
    "expectedInstallAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "orderValue" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "measuredById" TEXT NOT NULL,
    "status" "MeasurementStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "notes" TEXT,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "surface" "SurfaceType" NOT NULL,
    "openingType" "OpeningType",
    "widthMm" DECIMAL(10,2) NOT NULL,
    "heightMm" DECIMAL(10,2) NOT NULL,
    "depthMm" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "deductions" JSONB,
    "family" "ProductFamily" NOT NULL,
    "headingType" "HeadingType",
    "fullness" DECIMAL(4,2),
    "mountType" "MountType",
    "trackTypeNote" TEXT,
    "requiresPowerPoint" BOOLEAN NOT NULL DEFAULT false,
    "floorLevelDiffMm" DECIMAL(10,2),
    "photoKeys" TEXT[],
    "notes" TEXT,

    CONSTRAINT "MeasurementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalcResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "measurementItemId" TEXT NOT NULL,
    "colourwayId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "materialQty" DECIMAL(12,3) NOT NULL,
    "materialUnit" "SellUnit" NOT NULL,
    "widthsRequired" INTEGER,
    "cutLengthMm" DECIMAL(10,2),
    "rollsRequired" INTEGER,
    "boxesRequired" INTEGER,
    "areaSqft" DECIMAL(12,3),
    "billableAreaSqft" DECIMAL(12,3),
    "wastagePct" DECIMAL(5,2),
    "fabricRun" "FabricRun",
    "seamCount" INTEGER,
    "liningQty" DECIMAL(12,3),
    "warnings" TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalcResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "taxableAmount" BIGINT NOT NULL DEFAULT 0,
    "cgst" BIGINT NOT NULL DEFAULT 0,
    "sgst" BIGINT NOT NULL DEFAULT 0,
    "igst" BIGINT NOT NULL DEFAULT 0,
    "roundOff" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "termsText" TEXT,
    "ownerId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "measurementItemId" TEXT,
    "roomLabel" TEXT,
    "colourwayId" TEXT,
    "serviceRateId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "SellUnit" NOT NULL,
    "rate" BIGINT NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable" BIGINT NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL,
    "cgst" BIGINT NOT NULL,
    "sgst" BIGINT NOT NULL,
    "igst" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "calcSnapshot" JSONB,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quotationId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalValue" BIGINT NOT NULL,
    "advanceRequired" BIGINT NOT NULL DEFAULT 0,
    "advanceReceived" BIGINT NOT NULL DEFAULT 0,
    "promisedInstallAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "measurementItemId" TEXT,
    "colourwayId" TEXT,
    "serviceRateId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "SellUnit" NOT NULL,
    "rate" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "procuredQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "madeQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "installedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "address" JSONB,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "brandIds" TEXT[],
    "rating" INTEGER,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "expectedAt" TIMESTAMP(3),
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "totalValue" BIGINT NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "colourwayId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "SellUnit" NOT NULL,
    "rate" BIGINT NOT NULL,
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,

    CONSTRAINT "POLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRN" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "vendorId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "invoiceRef" TEXT,

    CONSTRAINT "GRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GRNLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "colourwayId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rejectedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "rate" BIGINT NOT NULL,
    "dyeLot" TEXT,
    "rollCount" INTEGER,
    "rollLengthsM" JSONB,
    "binLocation" TEXT,

    CONSTRAINT "GRNLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "colourwayId" TEXT NOT NULL,
    "dyeLot" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reserved" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "value" BIGINT NOT NULL,
    "binLocation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMove" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "colourwayId" TEXT NOT NULL,
    "dyeLot" TEXT,
    "type" "StockMoveType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" BIGINT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "projectId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "colourwayId" TEXT NOT NULL,
    "dyeLot" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "mixedLotOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakeJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT,
    "status" "MakeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "assignedToId" TEXT,
    "targetDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MakeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakeJobLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "makeJobId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "measurementItemId" TEXT,
    "roomLabel" TEXT NOT NULL,
    "panels" INTEGER,
    "cutLengthMm" DECIMAL(10,2),
    "fabricIssuedM" DECIMAL(12,3),
    "liningIssuedM" DECIMAL(12,3),
    "headingType" "HeadingType",
    "eyeletCount" INTEGER,
    "stitchSpec" TEXT,
    "actualUsedM" DECIMAL(12,3),
    "wastageM" DECIMAL(12,3),
    "qcPassed" BOOLEAN NOT NULL DEFAULT false,
    "qcNotes" TEXT,

    CONSTRAINT "MakeJobLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallCrew" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadEmployeeId" TEXT NOT NULL,
    "memberEmployeeIds" TEXT[],
    "skills" "ProductFamily"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InstallCrew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallVisit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "crewId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "InstallStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rescheduleReason" TEXT,
    "clientSignatureKey" TEXT,
    "photoKeys" TEXT[],
    "notes" TEXT,

    CONSTRAINT "InstallVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "installVisitId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "roomLabel" TEXT NOT NULL,
    "plannedQty" DECIMAL(12,3) NOT NULL,
    "installedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "dyeLotUsed" TEXT,
    "remoteSerials" TEXT[],
    "photoKeys" TEXT[],
    "issue" TEXT,

    CONSTRAINT "InstallLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomLabel" TEXT,
    "raisedById" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "photoKeys" TEXT[],
    "status" "SnagStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "Snag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL DEFAULT 'TAX',
    "projectId" TEXT,
    "orderId" TEXT,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "placeOfSupplyCode" TEXT NOT NULL,
    "taxableAmount" BIGINT NOT NULL,
    "cgst" BIGINT NOT NULL,
    "sgst" BIGINT NOT NULL,
    "igst" BIGINT NOT NULL,
    "roundOff" BIGINT NOT NULL,
    "total" BIGINT NOT NULL,
    "advanceAdjusted" BIGINT NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "irn" TEXT,
    "ackNo" TEXT,
    "ackDate" TIMESTAMP(3),
    "qrCode" TEXT,
    "irnStatus" "IrnStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "irnError" TEXT,
    "ewbNumber" TEXT,
    "ewbValidUntil" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "orderLineId" TEXT,
    "description" TEXT NOT NULL,
    "hsn" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" "SellUnit" NOT NULL,
    "rate" BIGINT NOT NULL,
    "taxable" BIGINT NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL,
    "cgst" BIGINT NOT NULL,
    "sgst" BIGINT NOT NULL,
    "igst" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "adjusted" BIGINT NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "chequeStatus" "ChequeStatus",
    "chequeDate" TIMESTAMP(3),
    "amount" BIGINT NOT NULL,
    "unallocated" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "ReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "head" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "billKey" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "approvalState" "ApprovalState" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,

    CONSTRAINT "ProjectExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "head" TEXT NOT NULL,
    "subHead" TEXT,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "billKey" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "approvalState" "ApprovalState" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "inAt" TIMESTAMP(3),
    "outAt" TIMESTAMP(3),
    "inLat" DECIMAL(10,7),
    "inLng" DECIMAL(10,7),
    "selfieKey" TEXT,
    "projectId" TEXT,
    "otHours" DECIMAL(5,2),
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "days" DECIMAL(4,1) NOT NULL,
    "reason" TEXT,
    "state" "ApprovalState" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutorySlab" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stateCode" TEXT,
    "fromAmount" BIGINT NOT NULL,
    "toAmount" BIGINT,
    "rate" DECIMAL(6,3),
    "flatAmount" BIGINT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "StatutorySlab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "daysPresent" DECIMAL(4,1) NOT NULL,
    "lopDays" DECIMAL(4,1) NOT NULL,
    "otHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "earnings" JSONB NOT NULL,
    "deductions" JSONB NOT NULL,
    "netPay" BIGINT NOT NULL,
    "pdfKey" TEXT,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metaTemplateName" TEXT NOT NULL,
    "category" "MsgCategory" NOT NULL,
    "language" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "variables" TEXT[],
    "metaStatus" TEXT NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "templateId" TEXT,
    "category" "MsgCategory" NOT NULL,
    "toMobile" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "status" "MsgStatus" NOT NULL DEFAULT 'QUEUED',
    "metaMessageId" TEXT,
    "costPaise" BIGINT NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "projectId" TEXT,
    "serviceWindowExpiresAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "outcome" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "yymm" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "AppRole",
    "tableKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_organizationId_idx" ON "Branch"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_mobile_key" ON "User"("organizationId", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_code_key" ON "Employee"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_organizationId_name_key" ON "Brand"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Collection_organizationId_family_idx" ON "Collection"("organizationId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_organizationId_brandId_name_key" ON "Collection"("organizationId", "brandId", "name");

-- CreateIndex
CREATE INDEX "Design_organizationId_family_idx" ON "Design"("organizationId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "Design_organizationId_collectionId_code_key" ON "Design"("organizationId", "collectionId", "code");

-- CreateIndex
CREATE INDEX "Colourway_organizationId_designId_idx" ON "Colourway"("organizationId", "designId");

-- CreateIndex
CREATE UNIQUE INDEX "Colourway_organizationId_code_key" ON "Colourway"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Price_colourwayId_tier_effectiveFrom_idx" ON "Price"("colourwayId", "tier", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRate_organizationId_code_effectiveFrom_key" ON "ServiceRate"("organizationId", "code", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SampleBook_organizationId_barcode_key" ON "SampleBook"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "SampleIssue_organizationId_dueAt_idx" ON "SampleIssue"("organizationId", "dueAt");

-- CreateIndex
CREATE INDEX "Lead_organizationId_stage_ownerId_idx" ON "Lead"("organizationId", "stage", "ownerId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_mobile_idx" ON "Lead"("organizationId", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_number_key" ON "Lead"("organizationId", "number");

-- CreateIndex
CREATE INDEX "Client_organizationId_mobile_idx" ON "Client"("organizationId", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_code_key" ON "Client"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Architect_organizationId_code_key" ON "Architect"("organizationId", "code");

-- CreateIndex
CREATE INDEX "ArchitectCommission_organizationId_architectId_paidAt_idx" ON "ArchitectCommission"("organizationId", "architectId", "paidAt");

-- CreateIndex
CREATE INDEX "Project_organizationId_stage_idx" ON "Project"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "Project_organizationId_clientId_idx" ON "Project"("organizationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_number_key" ON "Project"("organizationId", "number");

-- CreateIndex
CREATE INDEX "Room_projectId_idx" ON "Room"("projectId");

-- CreateIndex
CREATE INDEX "Measurement_projectId_status_idx" ON "Measurement"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_organizationId_number_key" ON "Measurement"("organizationId", "number");

-- CreateIndex
CREATE INDEX "MeasurementItem_measurementId_roomId_idx" ON "MeasurementItem"("measurementId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "CalcResult_measurementItemId_key" ON "CalcResult"("measurementItemId");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_projectId_status_idx" ON "Quotation"("organizationId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_organizationId_number_revision_key" ON "Quotation"("organizationId", "number", "revision");

-- CreateIndex
CREATE INDEX "QuotationLine_quotationId_idx" ON "QuotationLine"("quotationId");

-- CreateIndex
CREATE INDEX "Order_organizationId_status_idx" ON "Order"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_number_key" ON "Order"("organizationId", "number");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_organizationId_code_key" ON "Vendor"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_number_key" ON "PurchaseOrder"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "GRN_organizationId_number_key" ON "GRN"("organizationId", "number");

-- CreateIndex
CREATE INDEX "GRNLine_organizationId_colourwayId_dyeLot_idx" ON "GRNLine"("organizationId", "colourwayId", "dyeLot");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_colourwayId_dyeLot_key" ON "StockBalance"("colourwayId", "dyeLot");

-- CreateIndex
CREATE INDEX "StockMove_organizationId_colourwayId_dyeLot_occurredAt_idx" ON "StockMove"("organizationId", "colourwayId", "dyeLot", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMove_organizationId_refType_refId_idx" ON "StockMove"("organizationId", "refType", "refId");

-- CreateIndex
CREATE INDEX "Allocation_organizationId_orderLineId_idx" ON "Allocation"("organizationId", "orderLineId");

-- CreateIndex
CREATE INDEX "MakeJob_organizationId_status_idx" ON "MakeJob"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MakeJob_organizationId_number_key" ON "MakeJob"("organizationId", "number");

-- CreateIndex
CREATE INDEX "MakeJobLine_makeJobId_idx" ON "MakeJobLine"("makeJobId");

-- CreateIndex
CREATE INDEX "InstallVisit_organizationId_scheduledAt_status_idx" ON "InstallVisit"("organizationId", "scheduledAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstallVisit_organizationId_number_key" ON "InstallVisit"("organizationId", "number");

-- CreateIndex
CREATE INDEX "InstallLine_installVisitId_idx" ON "InstallLine"("installVisitId");

-- CreateIndex
CREATE INDEX "Snag_organizationId_status_idx" ON "Snag"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_clientId_status_idx" ON "Invoice"("organizationId", "clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_branchId_number_key" ON "Invoice"("organizationId", "branchId", "number");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Advance_organizationId_projectId_idx" ON "Advance"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_organizationId_number_key" ON "Receipt"("organizationId", "number");

-- CreateIndex
CREATE INDEX "ReceiptAllocation_invoiceId_idx" ON "ReceiptAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "ProjectExpense_organizationId_projectId_idx" ON "ProjectExpense"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "Expense_organizationId_incurredAt_idx" ON "Expense"("organizationId", "incurredAt");

-- CreateIndex
CREATE INDEX "Attendance_organizationId_date_idx" ON "Attendance"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE INDEX "StatutorySlab_organizationId_kind_effectiveFrom_idx" ON "StatutorySlab"("organizationId", "kind", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_organizationId_month_year_key" ON "PayrollRun"("organizationId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrollRunId_employeeId_key" ON "Payslip"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_organizationId_metaTemplateName_language_key" ON "MessageTemplate"("organizationId", "metaTemplateName", "language");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationLog_idempotencyKey_key" ON "AutomationLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationLog_organizationId_createdAt_idx" ON "AutomationLog"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_organizationId_mobile_key" ON "WhatsAppConversation"("organizationId", "mobile");

-- CreateIndex
CREATE INDEX "FollowUp_organizationId_ownerId_dueAt_idx" ON "FollowUp"("organizationId", "ownerId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_organizationId_series_yymm_key" ON "NumberSequence"("organizationId", "series", "yymm");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx" ON "AuditLog"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_organizationId_key_key" ON "Setting"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colourway" ADD CONSTRAINT "Colourway_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_colourwayId_fkey" FOREIGN KEY ("colourwayId") REFERENCES "Colourway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleBook" ADD CONSTRAINT "SampleBook_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleIssue" ADD CONSTRAINT "SampleIssue_sampleBookId_fkey" FOREIGN KEY ("sampleBookId") REFERENCES "SampleBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchitectCommission" ADD CONSTRAINT "ArchitectCommission_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "Architect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementItem" ADD CONSTRAINT "MeasurementItem_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementItem" ADD CONSTRAINT "MeasurementItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcResult" ADD CONSTRAINT "CalcResult_measurementItemId_fkey" FOREIGN KEY ("measurementItemId") REFERENCES "MeasurementItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_measurementItemId_fkey" FOREIGN KEY ("measurementItemId") REFERENCES "MeasurementItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POLine" ADD CONSTRAINT "POLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRN" ADD CONSTRAINT "GRN_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GRNLine" ADD CONSTRAINT "GRNLine_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GRN"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_colourwayId_fkey" FOREIGN KEY ("colourwayId") REFERENCES "Colourway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeJobLine" ADD CONSTRAINT "MakeJobLine_makeJobId_fkey" FOREIGN KEY ("makeJobId") REFERENCES "MakeJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallVisit" ADD CONSTRAINT "InstallVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallLine" ADD CONSTRAINT "InstallLine_installVisitId_fkey" FOREIGN KEY ("installVisitId") REFERENCES "InstallVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snag" ADD CONSTRAINT "Snag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── RAW SQL EXTRAS (CLAUDE.md §5) ──────────────────────────────────────────

-- Full-text and fuzzy search infrastructure
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- tsvector trigger for Design.searchVector (populated automatically on INSERT/UPDATE)
CREATE OR REPLACE FUNCTION design_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.hsn,  '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER design_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "Design"
  FOR EACH ROW EXECUTE FUNCTION design_search_vector_update();

-- GIN index on tsvector for fast full-text search
CREATE INDEX "Design_searchVector_idx" ON "Design" USING GIN ("searchVector");

-- pg_trgm GIN indexes for sub-200ms fuzzy code search across 3,500 colourways
CREATE INDEX "Design_code_trgm_idx"    ON "Design"    USING GIN (code    gin_trgm_ops);
CREATE INDEX "Colourway_code_trgm_idx" ON "Colourway" USING GIN (code    gin_trgm_ops);

-- GIN index on Design.specs (jsonb) for attribute filtering
CREATE INDEX "Design_specs_gin_idx" ON "Design" USING GIN (specs);

-- Append-only enforcement: AuditLog and StockMove must never be updated or deleted
CREATE OR REPLACE FUNCTION enforce_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only — reversals are new rows', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_no_update" BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();
CREATE TRIGGER "AuditLog_no_delete" BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE TRIGGER "StockMove_no_update" BEFORE UPDATE ON "StockMove"
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();
CREATE TRIGGER "StockMove_no_delete" BEFORE DELETE ON "StockMove"
  FOR EACH ROW EXECUTE FUNCTION enforce_append_only();
