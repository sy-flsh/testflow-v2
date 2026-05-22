export type WorkspaceSettingsDto = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMemberDto = {
  id: string;
  userId: string;
  name: string;
  email: string;
  imageUrl: string;
  role: "Admin" | "Member" | "Viewer";
  status: "active" | "pending";
  joinedAt: string;
  lastActiveAt: string;
  lastActive: string;
};
