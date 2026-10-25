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

/** Phase 11: canonical failure category keys */
export type FailureCategory =
  | 'UNCAUGHT_JS_EXCEPTION'
  | 'SERVER_5XX'
  | 'DEAD_ASSET_OR_LINK'
  | 'AUTH_OR_SECURITY'
  | 'NAVIGATION_TIMEOUT'
  | 'RESOURCE_FAILURE'
  | 'UNKNOWN';

export interface FailureRecord {
  id: string;
  test_run_id: string;
  page_id?: string;
  failure_type: string;
  message: string;
  stack_trace?: string;
  severity: string;
  // Phase 11 classification
  fingerprint_hash?: string;
  category?: FailureCategory;
  occurrence_count?: number;
  root_cause_hint?: string;
  created_at: string;
}

/** Deduplicated failure summary returned by /unique-failures */
export interface FailureSummary {
  fingerprint_hash: string;
  failure_type: string;
  category: FailureCategory;
  severity: string;
  message: string;
  root_cause_hint?: string;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  failure_ids: string[];
}

export interface EvidenceRecord {
  id: string;
  failure_id: string;
  evidence_type: string;
  file_path: string;
  created_at: string;
}