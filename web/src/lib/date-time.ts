const koreanDateTime = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
});

export function formatKoreanDateTime(value: string | Date): string {
  return `${koreanDateTime.format(new Date(value))} KST`;
}
