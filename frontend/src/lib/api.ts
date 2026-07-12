// Typed client for the FastAPI backend.
//
// GET requests hit the backend directly (NEXT_PUBLIC_API_BASE, safe to expose).
// Mutating requests (POST/DELETE) go through /api/proxy/*, a same-origin route
// handler that attaches the server-only bearer token so it never reaches the browser.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

// ---------- Shared types ----------

export interface HealthStatus {
  status: string;
  db: string;
  model: string;
}

export interface ProviderInfo {
  models: string[];
  requires_key: boolean;
}

export type Providers = Record<string, ProviderInfo>;

export interface Benchmark {
  id: number;
  name: string;
  description: string;
  case_count: number;
  created_at: string;
}

export interface TestCase {
  id: number;
  benchmark_id: number;
  question: string;
  reference_text: string;
  domain: string;
  source_type: string;
  gold_label: string | null;
}

export interface Run {
  id: number;
  benchmark_id: number;
  benchmark_name: string;
  provider: string;
  model: string;
  status: string;
  avg_score: number | null;
  grounded_pct: number | null;
  error: string | null;
  run_at: string;
}

export interface RunDetail extends Run {
  completed_cases: number;
  total_cases: number;
}

export interface RunResult {
  test_case_id: number;
  question: string;
  domain: string;
  source_type: string;
  response: string;
  overall_label: string;
  hallucination_score: number;
  predicted_label: string;
}

export interface DomainScore {
  domain: string;
  total: number;
  avg_score: number;
  grounded: number;
  partial: number;
  hallucinated: number;
}

export interface RunMetrics {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  n: number;
}

export interface SourceTypeScore {
  source_type: string;
  total: number;
  avg_score: number | null;
  grounded: number;
  hallucinated: number;
}

export interface ComparePerCase {
  test_case_id: number;
  question: string;
  domain: string;
  source_type: string;
  score_a: number;
  label_a: string;
  score_b: number;
  label_b: string;
  delta: number;
  verdict: string;
}

export interface CompareResult {
  run_a: Run;
  run_b: Run;
  avg_score_a: number;
  avg_score_b: number;
  overall_delta: number;
  improved_count: number;
  regressed_count: number;
  stable_count: number;
  source_type_scores_a: Record<string, SourceTypeScore | null>;
  source_type_scores_b: Record<string, SourceTypeScore | null>;
  per_case: ComparePerCase[];
}

// ---------- Request bodies ----------

export interface CreateBenchmarkBody {
  name: string;
  description?: string;
}

export interface CreateCaseBody {
  question: string;
  reference_text: string;
  domain: string;
  source_type: string;
}

export interface BulkCasesBody {
  csv_text: string;
}

export interface BulkCasesResult {
  added: number;
}

export interface GenerateCasesBody {
  reference_text: string;
  num_cases: number;
  domain: string;
  source_type: string;
  provider: string;
  model: string;
  api_key?: string; // BYOK; blank falls back to the server env key
}

export interface GenerateCasesResult {
  generated: number;
  questions: string[];
}

export interface StartRunBody {
  benchmark_id: number;
  provider: string;
  model: string;
  api_key?: string; // BYOK; blank falls back to the server env key
  entail_threshold: number;
  contradict_threshold: number;
  grounded_ceiling: number;
  partial_ceiling: number;
}

export interface StartRunResult {
  run_id: number;
  status: string;
}

export interface SeedRagtruthBody {
  split: string;
  limit: number;
}

export interface SeedRagtruthResult {
  benchmark_id: number;
  added: number;
}

// ---------- Fetch helpers ----------

async function getJson<T>(
  path: string,
  searchParams?: Record<string, string | number>
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function proxyJson<T>(
  method: "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------- Endpoints ----------

export function getHealth(): Promise<HealthStatus> {
  return getJson<HealthStatus>("/health");
}

export function getProviders(): Promise<Providers> {
  return getJson<Providers>("/providers");
}

export function listBenchmarks(): Promise<Benchmark[]> {
  return getJson<Benchmark[]>("/benchmarks");
}

export function createBenchmark(body: CreateBenchmarkBody): Promise<Benchmark> {
  return proxyJson<Benchmark>("POST", "/benchmarks", body);
}

export function deleteBenchmark(id: number): Promise<void> {
  return proxyJson<void>("DELETE", `/benchmarks/${id}`);
}

export function listCases(benchmarkId: number): Promise<TestCase[]> {
  return getJson<TestCase[]>(`/benchmarks/${benchmarkId}/cases`);
}

export function createCase(benchmarkId: number, body: CreateCaseBody): Promise<TestCase> {
  return proxyJson<TestCase>("POST", `/benchmarks/${benchmarkId}/cases`, body);
}

export function bulkAddCases(
  benchmarkId: number,
  body: BulkCasesBody
): Promise<BulkCasesResult> {
  return proxyJson<BulkCasesResult>("POST", `/benchmarks/${benchmarkId}/cases/bulk`, body);
}

export function generateCases(
  benchmarkId: number,
  body: GenerateCasesBody
): Promise<GenerateCasesResult> {
  return proxyJson<GenerateCasesResult>(
    "POST",
    `/benchmarks/${benchmarkId}/generate-cases`,
    body
  );
}

export function deleteCase(caseId: number): Promise<void> {
  return proxyJson<void>("DELETE", `/cases/${caseId}`);
}

export function listRuns(): Promise<Run[]> {
  return getJson<Run[]>("/runs");
}

export function startRun(body: StartRunBody): Promise<StartRunResult> {
  return proxyJson<StartRunResult>("POST", "/runs", body);
}

export function getRun(id: number): Promise<RunDetail> {
  return getJson<RunDetail>(`/runs/${id}`);
}

export function getResults(id: number): Promise<RunResult[]> {
  return getJson<RunResult[]>(`/runs/${id}/results`);
}

export function getDomains(id: number): Promise<DomainScore[]> {
  return getJson<DomainScore[]>(`/runs/${id}/domains`);
}

// 404 means metrics aren't available yet (e.g. no gold labels) — not an error.
export async function getMetrics(id: number): Promise<RunMetrics | null> {
  const res = await fetch(`${API_BASE}/runs/${id}/metrics`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`GET /runs/${id}/metrics failed: ${res.status}`);
  }
  return res.json() as Promise<RunMetrics>;
}

export function compare(runA: number, runB: number): Promise<CompareResult> {
  return getJson<CompareResult>("/compare", { run_a: runA, run_b: runB });
}

export function seedRagtruth(body: SeedRagtruthBody): Promise<SeedRagtruthResult> {
  return proxyJson<SeedRagtruthResult>("POST", "/datasets/ragtruth/seed", body);
}
