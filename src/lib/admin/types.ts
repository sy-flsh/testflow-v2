import type { InvitationPagination } from "@/lib/company/types";

/**
 * c10-2: MasterAdmin 탈퇴 계정 목록 DTO.
 * 운영상 최소 정보만 노출한다 — passwordHash/session/token/role/company/member/state/audit metadata 미포함.
 * deletedByUserId 는 scalar ID 만(이름/이메일로 resolve 하지 않는다).
 */
export type DeletedAccountDto = {
  userId: string;
  name: string;
  email: string;
  deletedAt: string;
  deletedByUserId: string | null;
  deletionReason: string | null;
};

export type DeletedAccountListDto = {
  users: DeletedAccountDto[];
  pagination: InvitationPagination;
  filters: { q: string | null; sort: "newest" | "oldest" };
};
