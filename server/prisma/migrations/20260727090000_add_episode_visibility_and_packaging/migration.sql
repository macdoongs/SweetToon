-- 에피소드 공개 상태: 기존 데이터는 모두 공개 상태로 유지한다.
ALTER TABLE "Episode" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';

-- 책 패키징 서비스 신청 접수 기록
CREATE TABLE "PackagingRequest" (
    "id" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "bookTitle" TEXT NOT NULL,
    "bookSize" TEXT NOT NULL,
    "coverType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "memo" TEXT,
    "pageCount" INTEGER NOT NULL,
    "manuscriptDir" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackagingRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PackagingRequest_createdAt_idx" ON "PackagingRequest"("createdAt");
