"use client";

import { createContext, useContext } from "react";

/**
 * c10-5: AdminReauthGate 가 children(admin view)에 전달하는 콜백.
 * protected admin API 가 ADMIN_REAUTH_REQUIRED(403)를 반환하면 view 가 이 콜백을 호출해
 * gate 화면으로 전환한다(민감 목록/감사를 stale 로 노출하지 않기 위함).
 * gate 밖에서 단독 렌더될 때를 대비해 기본값은 no-op.
 */
export const AdminReauthContext = createContext<{ onReauthRequired: () => void }>({
  onReauthRequired: () => {},
});

export function useAdminReauth() {
  return useContext(AdminReauthContext);
}
