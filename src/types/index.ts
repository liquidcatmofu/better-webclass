export interface Assignment {
  title: string;
  course: string;
  deadline: Date | null;
  submitted: boolean;
  element: HTMLElement;
}

export interface CourseSummary {
  courseId: string;
  pending: number;
  overdue: number;
  submitted: number;
  nearestDeadline: number | null;  // ms timestamp
  updatedAt: number;
}

export interface ExtensionSettings {
  webclassUrl: string;
  enableUiEnhancer: boolean;
  enableFileHandler: boolean;
  enableAssignmentTracker: boolean;
  enableAutoRefresh: boolean;
  autoRefreshInterval: number; // minutes: 30 | 60 | 180
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  webclassUrl: "",
  enableUiEnhancer: true,
  enableFileHandler: true,
  enableAssignmentTracker: true,
  enableAutoRefresh: false,
  autoRefreshInterval: 360,
};
