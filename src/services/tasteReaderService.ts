import { NEWS_CONFIG } from '../constants/config';

export interface TasteReaderRunItem {
  position: number;
  contentId: number;
  score: number;
  space: string;
  title: string;
  description: string;
  link: string;
  image: string;
  pubDate: string;
  source: string;
  category: string;
  interestKeywords: string[] | null;
}

export interface TasteReaderRunResult {
  runId: string;
  totalCount: number;
  nextPosition: number;
  items: TasteReaderRunItem[];
}

/**
 * Start a manual Taste Reader run. The caller passes the signed-in
 * user's Supabase access token; the worker verifies it and checks
 * profiles.is_admin before building the pool.
 */
export async function runTasteReader(accessToken: string): Promise<TasteReaderRunResult> {
  const workerUrl = NEWS_CONFIG.workerUrl.replace(/\/$/, '');
  const response = await fetch(`${workerUrl}/api/taste-reader/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'Could not run Taste Reader';
    throw new Error(message);
  }
  const result = body as TasteReaderRunResult;
  if (!result || typeof result.runId !== 'string' || !Array.isArray(result.items)) {
    throw new Error('Taste Reader returned an unexpected response');
  }
  return result;
}

export type TasteReaderWordAction = 'up' | 'down' | 'next' | 'ignore' | 'ban';

export interface TasteReaderScoreInput {
  contentId: number;
  runId: string | null;
  wordDisplay: string;
  source: 'title' | 'description';
  wordPosition: number;
  action: TasteReaderWordAction;
}

export interface TasteReaderScoreResult {
  ok: boolean;
  scoreDelta: number;
  wordNormalized: string;
}

export interface TasteReaderNoteInput {
  contentId: number;
  runId: string | null;
  kind: 'user_note' | 'ai_reason';
  body: string;
  actionContext: 'viewed' | 'skipped' | 'ignored' | 'banned' | 'next' | null;
  stoppedWordNormalized: string | null;
  stoppedPosition: number | null;
  aiModel: string | null;
}

async function postTasteReader<T>(accessToken: string, path: string, body: unknown): Promise<T> {
  const workerUrl = NEWS_CONFIG.workerUrl.replace(/\/$/, '');
  const response = await fetch(`${workerUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const message = parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
      ? parsed.error
      : 'Taste Reader request failed';
    throw new Error(message);
  }
  return parsed as T;
}

export async function scoreTasteReaderWord(accessToken: string, input: TasteReaderScoreInput): Promise<TasteReaderScoreResult> {
  return postTasteReader<TasteReaderScoreResult>(accessToken, '/api/taste-reader/score', input);
}

export async function saveTasteReaderNote(accessToken: string, input: TasteReaderNoteInput): Promise<{ ok: boolean }> {
  return postTasteReader<{ ok: boolean }>(accessToken, '/api/taste-reader/note', input);
}

export async function generateTasteReaderReason(accessToken: string, title: string, description: string): Promise<{ reason: string; model: string }> {
  return postTasteReader<{ reason: string; model: string }>(accessToken, '/api/taste-reader/reason', { title, description });
}

/** Frontend mirror of the worker's normalizeTasteReaderWord: lowercase, punctuation trimmed from both ends. */
export function normalizeTasteReaderWord(word: string): string {
  return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}
