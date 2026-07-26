export const SITE_NAME = "SweetToon";
export const SITE_DESCRIPTION =
  "웹툰을 감상하고 완결 시즌을 나만의 단행본으로 소장하는 콘텐츠 플랫폼";
export const SITE_URL =
  process.env.SITE_URL ?? "http://localhost:3000";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
