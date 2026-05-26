export interface Assignment {
  title: string;
  course: string;
  deadline: Date | null;
  submitted: boolean;
  element: HTMLElement;
}

export interface ExtensionSettings {
  webclassUrl: string;
  enableUiEnhancer: boolean;
  enableFileHandler: boolean;
  enableAssignmentTracker: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  webclassUrl: "",
  enableUiEnhancer: true,
  enableFileHandler: true,
  enableAssignmentTracker: true,
};
