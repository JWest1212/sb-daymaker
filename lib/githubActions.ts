// QW8, the ingest workflow's Actions runs page. Shared by the restock POST
// (fresh Run-now dispatch) and the restock list GET (rail's existing rows),
// so "view runs" is available for a directive regardless of when it queued.
export function workflowRunsUrl(): string {
  const repo = process.env.GITHUB_REPO || "JWest1212/sb-daymaker";
  const workflow = process.env.GITHUB_WORKFLOW_FILE || "ingest.yml";
  return `https://github.com/${repo}/actions/workflows/${workflow}`;
}
