// 같은 장르가 이 수만큼 연속되면 다음 자리는 다른 장르를 먼저 찾는다.
const MAX_GENRE_RUN = 2;

// 규칙에 필요한 필드만 요구해 호출부가 응답 모델에 묶이지 않게 한다.
type VarietyCandidate = {
  series: { authorName: string; genre: string };
};

function violatesVariety(
  candidate: VarietyCandidate,
  picked: VarietyCandidate[],
): boolean {
  const previous = picked[picked.length - 1];
  if (!previous) return false;
  if (previous.series.authorName === candidate.series.authorName) return true;
  const run = picked
    .slice(-MAX_GENRE_RUN)
    .filter((item) => item.series.genre === candidate.series.genre).length;
  return run >= MAX_GENRE_RUN;
}

/**
 * 무작위 순서를 유지하면서 같은 작가가 연속하거나 같은 장르가 세 번 이상
 * 이어지는 자리만 뒤로 미룬다. 조건을 만족하는 후보가 없으면 원래 순서를
 * 그대로 쓴다. 후보 수를 줄이지 않으므로 배치 크기는 달라지지 않는다.
 */
export function orderShortsForVariety<Item extends VarietyCandidate>(
  candidates: Item[],
  limit: number,
): Item[] {
  const remaining = [...candidates];
  const picked: Item[] = [];
  const size = Math.min(limit, remaining.length);

  while (picked.length < size) {
    let index = remaining.findIndex(
      (candidate) => !violatesVariety(candidate, picked),
    );
    // 남은 후보가 모두 규칙에 걸리면 무작위 순서를 그대로 따른다.
    if (index === -1) index = 0;
    picked.push(remaining[index]);
    remaining.splice(index, 1);
  }

  return picked;
}
