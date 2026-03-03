/**
 * Project delay calculation utilities.
 *
 * Extracted from ProjectDelays page to enable reuse across
 * dashboard, alerts, and reporting modules.
 */

import { DELAY_THRESHOLDS, DELAY_STATUS_COLORS } from "@/config/defaults";

export type DelayStatus = "on_track" | "warning" | "critical" | "overdue";

export interface ProjectDelay {
  project: any;
  totalDays: number;
  elapsedDays: number;
  expectedProgress: number;
  actualProgress: number;
  delayPercent: number;
  delayDays: number;
  status: DelayStatus;
}

export function calculateProjectDelay(project: any, now = new Date()): ProjectDelay | null {
  if (!project.start_date) return null;

  const start = new Date(project.start_date);
  const end = project.end_date
    ? new Date(project.end_date)
    : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);

  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);
  const actualProgress = project.progress ?? 0;
  const delayPercent = Math.max(0, expectedProgress - actualProgress);
  const delayDays = Math.round((delayPercent / 100) * totalDays);

  let status: DelayStatus = "on_track";
  if (now > end) status = "overdue";
  else if (delayPercent > DELAY_THRESHOLDS.criticalPercent) status = "critical";
  else if (delayPercent > DELAY_THRESHOLDS.warningPercent) status = "warning";

  return { project, totalDays, elapsedDays, expectedProgress, actualProgress, delayPercent, delayDays, status };
}

export function calculateProjectDelays(projects: any[]): ProjectDelay[] {
  const now = new Date();
  return projects
    .map(p => calculateProjectDelay(p, now))
    .filter((d): d is ProjectDelay => d !== null)
    .sort((a, b) => b.delayPercent - a.delayPercent);
}

export function getDelayStatusColor(status: DelayStatus): string {
  return DELAY_STATUS_COLORS[status] || DELAY_STATUS_COLORS.default;
}

export function summarizeDelays(delays: ProjectDelay[]) {
  return {
    total: delays.length,
    onTrack: delays.filter(d => d.status === "on_track").length,
    warning: delays.filter(d => d.status === "warning").length,
    critical: delays.filter(d => d.status === "critical").length,
    overdue: delays.filter(d => d.status === "overdue").length,
  };
}
