export function episodeLabel(number: number, title: string): string {
  const numberLabel = `${number}화`;
  return title.trim() === numberLabel
    ? numberLabel
    : `${numberLabel} - ${title}`;
}
