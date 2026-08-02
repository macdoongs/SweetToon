// 서버(`server/src/repositories/shorts-variety.ts`)가 배치 안쪽 간격을 맞추고,
// 이 모듈은 배치와 배치가 맞닿는 자리만 보정한다. 두 규칙은 같아야 한다.
const MAX_GENRE_RUN = 2;

type VarietyItem = {
  series: { authorName: string; genre: string };
};

function violatesVariety(candidate: VarietyItem, tail: VarietyItem[]): boolean {
  const previous = tail[tail.length - 1];
  if (!previous) return false;
  if (previous.series.authorName === candidate.series.authorName) return true;
  const run = tail
    .slice(-MAX_GENRE_RUN)
    .filter((item) => item.series.genre === candidate.series.genre).length;
  return run >= MAX_GENRE_RUN;
}

/**
 * 새 배치의 첫 항목이 직전 카드들과 겹치면 겹치지 않는 항목이 앞에 오도록
 * 배치를 회전시킨다. 항목을 버리거나 추가하지 않으므로 배치 크기는 그대로다.
 */
export function rotateBatchForVariety<Item extends VarietyItem>(
  batch: Item[],
  tail: VarietyItem[],
): Item[] {
  if (batch.length < 2 || tail.length === 0) return batch;
  if (!violatesVariety(batch[0], tail)) return batch;

  const pivot = batch.findIndex((item) => !violatesVariety(item, tail));
  // 겹치지 않는 항목이 없으면 서버가 정한 순서를 그대로 둔다.
  if (pivot <= 0) return batch;
  return [...batch.slice(pivot), ...batch.slice(0, pivot)];
}
