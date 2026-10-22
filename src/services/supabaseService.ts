import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants/config';
import { ReactionType, ReactionCounts, NewsItem, AdItem } from '../types';
import { getKeywordTokens, getTokenVariants } from './urlService';

let supabaseClient: SupabaseClient | null = null;

if (
  SUPABASE_CONFIG.url &&
  SUPABASE_CONFIG.publishableKey.startsWith('sb_publishable_') &&
  (SUPABASE_CONFIG.publishableKey as string) !== 'sb_publishable_REPLACE_WITH_PROJECT_KEY'
) {
  try {
    supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);
  } catch (err) {
    console.warn('Supabase initialization failed:', err);
  }
}

export function getStoryId(title: string, link: string): string {
  const str = ((link || '') + (title || '')).toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 's_' + Math.abs(hash).toString(36).slice(0, 10);
}

export function hasUserReacted(storyId: string, type: ReactionType): boolean {
  try {
    return localStorage.getItem(`voted_${storyId}_${type}`) === 'true';
  } catch {
    return false;
  }
}

/**
 * Searches the Supabase `news_stories` table directly when public read access is available.
 */
export async function searchSupabaseStoriesByKeyword(keyword: string): Promise<NewsItem[]> {
  if (!supabaseClient || !keyword.trim()) return [];
  const terms = Array.from(
    new Set(getKeywordTokens(keyword).flatMap(t => getTokenVariants(t)))
  )
    .map(t => t.replace(/[,()*%]/g, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  if (terms.length === 0) return [];

  const orClauses = terms
    .flatMap(term => [
      `title.ilike.*${term}*`,
      `description.ilike.*${term}*`,
      `content.ilike.*${term}*`,
      `ai_summary.ilike.*${term}*`,
      `source_name.ilike.*${term}*`,
      `category.ilike.*${term}*`
    ])
    .join(',');

  try {
    const { data, error } = await supabaseClient
      .from('news_stories')
      .select('provider,category,title,article_url,image_url,description,content,ai_summary,published_at,source_name,approved,fetched_at')
      .eq('removed', false)
      .or(orClauses)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error || !Array.isArray(data)) return [];

    return data
      .filter((row: any) => row && typeof row.article_url === 'string' && typeof row.title === 'string')
      .map((row: any) => ({
        title: row.title,
        link: row.article_url,
        image: row.image_url || '',
        description: row.description || '',
        content: row.content || '',
        aiSummary: row.ai_summary || '',
        pubDate: row.published_at || '',
        fetchedAt: row.fetched_at || '',
        source: row.source_name || '',
        provider: row.provider || '',
        category: row.category || 'all',
        approved: Boolean(row.approved)
      }));
  } catch {
    return [];
  }
}

/**
 * Searches a Supabase `ads` table if present.
 */
export async function searchSupabaseAdsByKeyword(keyword: string): Promise<AdItem[]> {
  if (!supabaseClient || !keyword.trim()) return [];
  const terms = Array.from(
    new Set(getKeywordTokens(keyword).flatMap(t => getTokenVariants(t)))
  )
    .map(t => t.replace(/[,()*%]/g, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  if (terms.length === 0) return [];

  const orClauses = terms
    .flatMap(term => [
      `title.ilike.*${term}*`,
      `desc.ilike.*${term}*`,
      `sponsor.ilike.*${term}*`,
      `category.ilike.*${term}*`
    ])
    .join(',');

  try {
    const { data, error } = await supabaseClient
      .from('ads')
      .select('title,desc,img,cta,sponsor,url,category')
      .or(orClauses)
      .limit(50);

    if (error || !Array.isArray(data)) return [];

    return data
      .filter((row: any) => row && typeof row.title === 'string')
      .map((row: any) => ({
        title: row.title,
        desc: row.desc || '',
        img: row.img || 'img/all_1.jpg',
        cta: row.cta || 'Explore →',
        sponsor: row.sponsor || 'Featured Partner',
        url: row.url || '#',
        category: row.category || 'all'
      }));
  } catch {
    return [];
  }
}

export async function fetchReactionsForStories(
  storyIds: string[]
): Promise<Record<string, ReactionCounts>> {
  const result: Record<string, ReactionCounts> = {};
  storyIds.forEach(id => {
    result[id] = { love: 0, mind: 0, cozy: 0 };
  });

  if (!supabaseClient || storyIds.length === 0) {
    // Read local cache counts if offline
    storyIds.forEach(id => {
      const types: ReactionType[] = ['love', 'mind', 'cozy'];
      types.forEach(type => {
        const localCount = localStorage.getItem(`count_${id}_${type}`);
        if (localCount) {
          result[id][type] = parseInt(localCount, 10) || 0;
        }
      });
    });
    return result;
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_CONFIG.tableName)
      .select('story_id, reaction_type, count')
      .in('story_id', storyIds);

    if (error) throw error;

    if (data && data.length) {
      data.forEach(row => {
        const storyId = row.story_id;
        const type = row.reaction_type as ReactionType;
        if (result[storyId] && (type === 'love' || type === 'mind' || type === 'cozy')) {
          result[storyId][type] = row.count ?? 0;
        }
      });
    }
  } catch (err) {
    console.warn('Supabase reaction sync notice:', err);
  }

  return result;
}

export async function toggleStoryReaction(
  storyId: string,
  type: ReactionType
): Promise<{ success: boolean; newCount?: number; isVoted: boolean }> {
  const alreadyVoted = hasUserReacted(storyId, type);

  if (!supabaseClient) {
    // Offline local simulation
    const current = parseInt(localStorage.getItem(`count_${storyId}_${type}`) || '0', 10);
    const updated = alreadyVoted ? Math.max(0, current - 1) : current + 1;
    localStorage.setItem(`count_${storyId}_${type}`, String(updated));
    if (alreadyVoted) {
      localStorage.removeItem(`voted_${storyId}_${type}`);
    } else {
      localStorage.setItem(`voted_${storyId}_${type}`, 'true');
    }
    return { success: true, newCount: updated, isVoted: !alreadyVoted };
  }

  try {
    const rpcMethod = alreadyVoted ? 'decrement_reaction' : 'increment_reaction';
    const { data: dbCount, error } = await supabaseClient.rpc(rpcMethod, {
      p_story_id: storyId,
      p_reaction_type: type
    });

    if (error || typeof dbCount !== 'number' || !Number.isFinite(dbCount)) {
      throw error || new Error('Invalid response from reaction service');
    }

    if (alreadyVoted) {
      localStorage.removeItem(`voted_${storyId}_${type}`);
    } else {
      localStorage.setItem(`voted_${storyId}_${type}`, 'true');
    }

    return { success: true, newCount: dbCount, isVoted: !alreadyVoted };
  } catch (err) {
    console.warn('Reaction update failed on Supabase:', err);
    // Graceful fallback to local update
    const current = parseInt(localStorage.getItem(`count_${storyId}_${type}`) || '0', 10);
    const updated = alreadyVoted ? Math.max(0, current - 1) : current + 1;
    localStorage.setItem(`count_${storyId}_${type}`, String(updated));
    if (alreadyVoted) {
      localStorage.removeItem(`voted_${storyId}_${type}`);
    } else {
      localStorage.setItem(`voted_${storyId}_${type}`, 'true');
    }
    return { success: true, newCount: updated, isVoted: !alreadyVoted };
  }
}

export function subscribeToReactions(
  onUpdate: (storyId: string, type: ReactionType, count: number) => void
) {
  if (!supabaseClient) return () => {};

  try {
    const channel = supabaseClient
      .channel('realtime_reactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: SUPABASE_CONFIG.tableName },
        payload => {
          const row = payload.new as { story_id?: string; reaction_type?: string; count?: number };
          if (row && row.story_id && row.reaction_type && row.count != null) {
            onUpdate(row.story_id, row.reaction_type as ReactionType, row.count);
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient?.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Could not setup realtime channel:', err);
    return () => {};
  }
}
