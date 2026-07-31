import { loadSecurityAccessKey } from "./security-access";

// 스튜디오 접근 키는 layout의 입력이 sessionStorage에 저장하고, 각 화면의
// 변경 요청은 호출 시점에 최신 키를 읽는다.
export function studioHeaders(): Record<string, string> {
  const key = loadSecurityAccessKey("studio").trim();
  return key ? { "x-sweettoon-studio-key": key } : {};
}
