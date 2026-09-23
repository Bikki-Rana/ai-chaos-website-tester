export interface Project {
  id: string;
  name: string;
  url: string;
  description?: string;
  testing_objective?: string;
  created_at: string;
}

export interface TestRun {
  id: string;
  project_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  error_message?: string;
  created_at: string;
}

export interface RunStartOptions {
  max_pages: number;
  max_depth: number;
}

export interface PageInfo {
  id: string;
  url: string;
  title: string;
  load_time_ms?: number;
  depth?: number;
}

export interface StateData {
  element_count: number;
  selectors: string[];
  title_hint: string;
}

export interface StateRecord {
  id: string;
  test_run_id: string;
  page_id?: string;
  dom_hash: string;
  state_data: StateData;
  created_at: string;
}

export interface ActionRecord {
  id: string;
  test_run_id: string;
  page_id?: string;
  action_type: string;
  target_selector?: string;
  value?: string;
  status: string;
  error_message?: string;
  created_at: string;
}
