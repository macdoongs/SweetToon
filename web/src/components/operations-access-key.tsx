"use client";

import { useState } from "react";
import {
  loadSecurityAccessKey,
  saveSecurityAccessKey,
} from "@/lib/security-access";

export function OperationsAccessKey() {
  const [accessKey, setAccessKey] = useState(() =>
    loadSecurityAccessKey("operations"),
  );
  return (
    <details className="operations-security-access">
      <summary>운영 보안 설정</summary>
      <label className="field">
        <span>운영자 접근 키</span>
        <input
          autoComplete="off"
          onChange={(event) => {
            setAccessKey(event.target.value);
            saveSecurityAccessKey("operations", event.target.value);
          }}
          placeholder="운영 strict 모드에서만 필요"
          type="password"
          value={accessKey}
        />
      </label>
      <p>키는 현재 탭의 sessionStorage에만 보관됩니다.</p>
    </details>
  );
}
