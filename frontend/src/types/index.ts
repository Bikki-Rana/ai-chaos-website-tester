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