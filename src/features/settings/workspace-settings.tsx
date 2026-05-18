"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  Mail,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { DialogShell } from "@/components/common/dialog-shell";
import { FormField, SelectField, TextAreaField, TextInput } from "@/components/common/form-field";
import type { Member, MemberRole } from "@/lib/domain/types";
import { mockMembers, mockPendingInvites } from "@/lib/mock/mock-data";
import { cn } from "@/lib/utils";

type SettingsTab = "general" | "members" | "roles" | "danger";

const workspaceName = "TestFlow QA";

const tabs: Array<{ id: SettingsTab; label: string; description: string; icon: LucideIcon }> = [
  { id: "general", label: "일반", description: "워크스페이스 기본 정보", icon: Shield },
  { id: "members", label: "멤버", description: "멤버와 초대 관리", icon: Users },
  { id: "roles", label: "역할 및 권한", description: "MVP 권한 정책 보기", icon: Crown },
  { id: "danger", label: "위험구역", description: "삭제 등 위험 작업", icon: AlertTriangle },
];

const roleCards: Array<{
  role: MemberRole;
  description: string;
  count: number;
  permissions: string[];
}> = [
  {
    role: "Admin",
    description: "워크스페이스 설정과 모든 프로젝트를 관리합니다.",
    count: 1,
    permissions: ["프로젝트 생성", "멤버 관리", "결함 삭제", "위험 작업"],
  },
  {
    role: "Member",
    description: "테스트케이스, 실행 결과, 결함을 작성하고 수정합니다.",
    count: 2,
    permissions: ["TC 작성", "실행 결과 저장", "결함 등록"],
  },
  {
    role: "Viewer",
    description: "프로젝트와 보고서를 읽기 전용으로 확인합니다.",
    count: 1,
    permissions: ["보고서 조회", "결함 조회", "설정 조회"],
  },
];

const permissionRows = [
  ["프로젝트 생성", true, false, false],
  ["테스트케이스 생성/수정", true, true, false],
  ["테스트 실행 결과 저장", true, true, false],
  ["결함 생성/수정", true, true, false],
  ["보고서 조회", true, true, true],
  ["멤버 초대", true, false, false],
  ["워크스페이스 삭제", true, false, false],
] as const;

export function WorkspaceSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [name, setName] = useState(workspaceName);
  const [slug, setSlug] = useState("testflow-qa");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [notice, setNotice] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRole | "all">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("Member");
  const [welcomeMessage, setWelcomeMessage] = useState(
    "TestFlow 워크스페이스에 초대합니다. 프로젝트 테스트 현황을 함께 확인해주세요.",
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const filteredMembers = useMemo(() => {
    const lowered = memberQuery.trim().toLowerCase();
    return mockMembers.filter((member) => {
      const matchesQuery =
        !lowered ||
        member.name.toLowerCase().includes(lowered) ||
        member.email.toLowerCase().includes(lowered);
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [memberQuery, roleFilter]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function submitInvite() {
    const emails = inviteEmails
      .split(/[\n,]/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      showNotice("초대할 이메일을 하나 이상 입력해주세요.");
      return;
    }

    setInviteOpen(false);
    setInviteEmails("");
    showNotice(`${emails.length}명에게 ${inviteRole} 역할 초대 mock을 준비했습니다.`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="tf-card h-fit p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition",
                isActive
                  ? "bg-blue-50 text-[var(--brand-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className="mt-1 block text-xs text-[var(--text-tertiary)]">{tab.description}</span>
              </span>
            </button>
          );
        })}
      </aside>

      <div className="space-y-5">
        {notice && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {notice}
          </div>
        )}

        {activeTab === "general" && (
          <GeneralTab
            name={name}
            slug={slug}
            timezone={timezone}
            onNameChange={setName}
            onSlugChange={setSlug}
            onTimezoneChange={setTimezone}
            onNotice={showNotice}
          />
        )}
        {activeTab === "members" && (
          <MembersTab
            members={filteredMembers}
            pendingInvites={mockPendingInvites}
            query={memberQuery}
            roleFilter={roleFilter}
            onQueryChange={setMemberQuery}
            onRoleFilterChange={setRoleFilter}
            onInviteOpen={() => setInviteOpen(true)}
          />
        )}
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "danger" && <DangerTab onDeleteOpen={() => setDeleteOpen(true)} />}
      </div>

      {inviteOpen && (
        <DialogShell
          title="멤버 초대"
          description="실제 이메일 발송은 후속 Phase에서 API로 연결합니다."
          onClose={() => setInviteOpen(false)}
          maxWidth="max-w-xl"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitInvite}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                <Mail className="h-4 w-4" />
                초대 보내기
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label="이메일">
              <TextAreaField
                value={inviteEmails}
                onChange={(event) => setInviteEmails(event.target.value)}
                rows={5}
                placeholder="qa@example.com, dev@example.com 또는 줄바꿈으로 여러 명 입력"
              />
            </FormField>
            <FormField label="역할">
              <SelectField value={inviteRole} onChange={(event) => setInviteRole(event.target.value as MemberRole)}>
                <option value="Admin">Admin</option>
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
              </SelectField>
            </FormField>
            <FormField label="환영 메시지">
              <TextAreaField
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
                rows={4}
              />
            </FormField>
          </div>
        </DialogShell>
      )}

      {deleteOpen && (
        <DialogShell
          title="워크스페이스 삭제"
          description="이 작업은 실제로 실행되지 않는 mock 확인 Dialog입니다."
          onClose={() => setDeleteOpen(false)}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleteConfirm !== workspaceName}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm("");
                  showNotice("워크스페이스 삭제는 mock으로만 확인되었습니다.");
                }}
                className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200"
              >
                영구 삭제
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              삭제를 진행하면 프로젝트, 테스트케이스, 실행 결과, 결함 데이터가 모두 삭제됩니다.
              v0.1 mock UI에서는 실제 삭제 API를 호출하지 않습니다.
            </div>
            <FormField label={`확인을 위해 ${workspaceName}을 정확히 입력하세요.`}>
              <TextInput
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                className="focus:border-red-500 focus:ring-red-100"
              />
            </FormField>
          </div>
        </DialogShell>
      )}
    </div>
  );
}

function GeneralTab({
  name,
  slug,
  timezone,
  onNameChange,
  onSlugChange,
  onTimezoneChange,
  onNotice,
}: {
  name: string;
  slug: string;
  timezone: string;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onNotice: (message: string) => void;
}) {
  return (
    <section className="tf-card">
      <SectionHeader title="일반" description="워크스페이스의 기본 표시 정보와 지역 설정입니다." />
      <div className="space-y-6 p-5">
        <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-xl font-semibold text-white">
            TF
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--text-primary)]">워크스페이스 로고</div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              JPG, PNG 업로드는 후속 Phase에서 실제 파일 저장과 연결합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onNotice("로고 업로드는 mock 버튼입니다.")}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            >
              <Upload className="h-4 w-4" />
              업로드
            </button>
            <button
              type="button"
              onClick={() => onNotice("로고 제거는 mock 버튼입니다.")}
              className="h-9 rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            >
              제거
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="워크스페이스 이름">
            <TextInput value={name} onChange={(event) => onNameChange(event.target.value)} />
          </FormField>
          <FormField label="URL slug">
            <TextInput
              value={slug}
              onChange={(event) => onSlugChange(event.target.value)}
              prefix="testflow.local/"
            />
          </FormField>
          <FormField label="시간대">
            <SelectField value={timezone} onChange={(event) => onTimezoneChange(event.target.value)}>
              <option value="Asia/Seoul">Asia/Seoul</option>
              <option value="UTC">UTC</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
            </SelectField>
          </FormField>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onNotice("워크스페이스 일반 설정이 mock으로 저장되었습니다.")}
            className="h-10 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            저장
          </button>
        </div>
      </div>
    </section>
  );
}

function MembersTab({
  members,
  pendingInvites,
  query,
  roleFilter,
  onQueryChange,
  onRoleFilterChange,
  onInviteOpen,
}: {
  members: Member[];
  pendingInvites: Member[];
  query: string;
  roleFilter: MemberRole | "all";
  onQueryChange: (value: string) => void;
  onRoleFilterChange: (value: MemberRole | "all") => void;
  onInviteOpen: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="tf-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <FormField label="역할 필터">
              <SelectField
                value={roleFilter}
                onChange={(event) => onRoleFilterChange(event.target.value as MemberRole | "all")}
              >
                <option value="all">전체 역할</option>
                <option value="Admin">Admin</option>
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
              </SelectField>
            </FormField>
          </div>
          <button
            type="button"
            onClick={onInviteOpen}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            <UserPlus className="h-4 w-4" />
            멤버 초대
          </button>
        </div>
      </section>

      <MemberTable title="활성 멤버" members={members} />
      <MemberTable title="대기 중인 초대" members={pendingInvites} isPending />
    </div>
  );
}

function RolesTab() {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        {roleCards.map((card) => (
          <article key={card.role} className="tf-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{card.role}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{card.description}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                {card.count}명
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {card.permissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                >
                  {permission}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="tf-card overflow-hidden">
        <SectionHeader
          title="권한 매트릭스"
          description="v0.1 MVP에서는 역할별 권한 커스터마이징을 제공하지 않습니다."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--text-tertiary)]">
              <tr>
                <th className="px-4 py-3 text-left">권한</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-center">Member</th>
                <th className="px-4 py-3 text-center">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {permissionRows.map(([permission, admin, member, viewer]) => (
                <tr key={permission}>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{permission}</td>
                  {[admin, member, viewer].map((allowed, index) => (
                    <td key={`${permission}-${index}`} className="px-4 py-3 text-center">
                      {allowed ? (
                        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-slate-300" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DangerTab({ onDeleteOpen }: { onDeleteOpen: () => void }) {
  return (
    <section className="tf-card border-red-200">
      <SectionHeader title="위험구역" description="되돌리기 어려운 워크스페이스 작업입니다." danger />
      <div className="space-y-4 p-5">
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-red-700">워크스페이스 삭제</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-red-700">
                모든 프로젝트, 테스트케이스, 실행 결과, 결함, 보고서 데이터를 삭제하는 위험 작업입니다.
                현재 단계에서는 실제 삭제 API를 호출하지 않습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onDeleteOpen}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              워크스페이스 삭제
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MemberTable({
  title,
  members,
  isPending = false,
}: {
  title: string;
  members: Member[];
  isPending?: boolean;
}) {
  return (
    <section className="tf-card overflow-hidden">
      <SectionHeader title={title} description={isPending ? "아직 수락하지 않은 초대입니다." : "현재 워크스페이스에 접근 가능한 멤버입니다."} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--text-tertiary)]">
            <tr>
              <th className="px-4 py-3 text-left">멤버</th>
              <th className="px-4 py-3 text-left">역할</th>
              <th className="px-4 py-3 text-left">상태</th>
              <th className="px-4 py-3 text-left">{isPending ? "초대일" : "최근 활동"}</th>
              <th className="w-12 px-4 py-3 text-right">더보기</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-blue-50/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-[var(--brand-primary)]">
                      {member.name === "초대 대기" ? "?" : member.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">{member.name}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={member.role} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                      member.status === "active"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-amber-50 text-amber-700 ring-amber-200",
                    )}
                  >
                    {member.status === "active" ? "Active" : "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{member.lastActive}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)]"
                    aria-label={`${member.email} 더보기`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RoleBadge({ role }: { role: MemberRole }) {
  const styles: Record<MemberRole, string> = {
    Admin: "bg-blue-50 text-blue-700 ring-blue-200",
    Member: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Viewer: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset", styles[role])}>
      {role}
    </span>
  );
}

function SectionHeader({
  title,
  description,
  danger = false,
}: {
  title: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <div className="border-b border-[var(--border-subtle)] px-5 py-4">
      <h2 className={cn("text-base font-semibold", danger ? "text-red-700" : "text-[var(--text-primary)]")}>
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
