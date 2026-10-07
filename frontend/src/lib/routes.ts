export const paths = {
  login: '/login',
  signup: '/signup',
  projects: '/projects',
  runs: '/runs',
  settings: '/settings',
  project: (id: string) => `/projects/${id}`,
  run: (id: string) => `/runs/${id}`,
};