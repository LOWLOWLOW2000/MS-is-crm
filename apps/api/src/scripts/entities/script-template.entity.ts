export interface ScriptTab {
  id: string;
  name: string;
  content: string;
  isCustom: boolean;
}

export interface ScriptTemplate {
  id: string;
  tenantId: string;
  name: string;
  industryTag: string | null;
  tabs: ScriptTab[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
