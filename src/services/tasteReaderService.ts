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
