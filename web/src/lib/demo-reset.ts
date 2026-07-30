import { CANDY_UPDATED_EVENT, forgetCandyWalletToken } from "./candy-wallet";
import { FAVORITES_UPDATED_EVENT } from "./favorites";

// 공용 데모 브라우저에 쌓인 개인 기록만 지운다. 테마와 리더 설정은
// 기기 환경에 가까운 값이므로 보존한다.
const DEMO_RECORD_KEYS = [
  "sweettoon:favorites",
  "sweettoon:reading-progress",
  "sweettoon:demo-entitlements",
];

export function clearDemoRecords(): boolean {
  try {
    for (const key of DEMO_RECORD_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    return false;
  }
  forgetCandyWalletToken();
  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent("sweettoon:progress"));
  window.dispatchEvent(new Event(CANDY_UPDATED_EVENT));
  return true;
}
