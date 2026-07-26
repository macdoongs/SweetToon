-- 스튜디오 발행 위치 기록: 기존 행은 null(스튜디오 밖 원고)로 둔다.
ALTER TABLE "Episode" ADD COLUMN "manuscriptDir" TEXT;
