"use client";

import type { Defect, DefectSeverity, DefectStatus, Priority } from "@/lib/domain/types";
import { createDefectId, loadMockDefects, saveMockDefects } from "@/lib/mock/mock-store";

export type MockDefect = Defect;
export type Severity = DefectSeverity;
export type DefectPriority = Priority;
export type { DefectStatus };
export { createDefectId, loadMockDefects, saveMockDefects };
