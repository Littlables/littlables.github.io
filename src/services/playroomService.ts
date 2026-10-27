import { getSupabaseClient } from './supabaseService';
import { slugify, hydrateSpaceEmoji, type Space } from './spaceService';
import type { Profile } from '../contexts/AuthContext';

export interface Playroom {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  theme: string | null;
  background_color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type PlayroomInput = Pick<
  Playroom,
  'name' | 'slug' | 'description' | 'logo_url' | 'theme' | 'background_color' | 'position'
>;

/** Slugs that can never be a playroom name (reserved URL segments). */
const RESERVED_PLAYROOM_SLUGS = new Set(['spaces']);

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');
  return client;
}

/** All playrooms for a user, in display order. */
export async function getUserPlayrooms(userId: string): Promise<Playroom[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('playrooms')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as Playroom[];
}

/** One playroom by owner's username + slug (for /@username/playroomslug). */
export async function getPlayroomBySlug(
  username: string,
  slug: string
): Promise<{ playroom: Playroom; ownerId: string; owner: Profile } | null> {
  const client = requireClient();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;
  const { data: playroom, error } = await client
    .from('playrooms')
    .select('*')
    .eq('user_id', profile.id)
    .eq('slug', slug.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!playroom) return null;
  return {
    playroom: playroom as Playroom,
    ownerId: profile.id as string,
    owner: profile as Profile,
  };
}

/** Spaces in a playroom, in playroom order. */
export async function getPlayroomSpaces(playroomId: string): Promise<Space[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('playroom_spaces')
    .select('position, boards(*)')
    .eq('playroom_id', playroomId)
    .order('position', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as Array<{ position: number; boards: Space | Space[] | null }>;
  const spaces: Space[] = [];
  for (const row of rows) {
    const s = Array.isArray(row.boards) ? row.boards[0] : row.boards;
    if (s) spaces.push(hydrateSpaceEmoji(s));
  }
  return spaces;
}

/** Batch-fetch spaces for multiple playrooms in a single query. */
export async function getPlayroomSpacesMap(playroomIds: string[]): Promise<Record<string, Space[]>> {
  const result: Record<string, Space[]> = {};
  for (const id of playroomIds) result[id] = [];
  if (playroomIds.length === 0) return result;
  const client = requireClient();
  const { data, error } = await client
    .from('playroom_spaces')
    .select('playroom_id, position, boards(*)')
    .in('playroom_id', playroomIds)
    .order('position', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as Array<{
    playroom_id: string;
    position: number;
    boards: Space | Space[] | null;
  }>;
  for (const row of rows) {
    const s = Array.isArray(row.boards) ? row.boards[0] : row.boards;
    if (s) {
      if (!result[row.playroom_id]) result[row.playroom_id] = [];
      result[row.playroom_id].push(hydrateSpaceEmoji(s));
    }
  }
  return result;
}

/** Ensure the slug is unique for this user and not reserved (appends -2, -3, ...). */
export async function ensureUniquePlayroomSlug(
  userId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.from('playrooms').select('id, slug').eq('user_id', userId);
  if (error) throw error;
  const taken = new Set((data || []).filter((p: any) => p.id !== excludeId).map((p: any) => p.slug));
  for (const reserved of RESERVED_PLAYROOM_SLUGS) taken.add(reserved);
  let slug = baseSlug;
  let n = 2;
  while (taken.has(slug)) {
    const suffix = `-${n++}`;
    slug = (baseSlug.slice(0, 50 - suffix.length) + suffix).replace(/-+$/, '');
  }
  return slug;
}

export async function createPlayroom(userId: string, input: PlayroomInput): Promise<Playroom> {
  const client = requireClient();
  const slug = await ensureUniquePlayroomSlug(userId, slugify(input.slug || input.name));
  const { data, error } = await client
    .from('playrooms')
    .insert({ ...input, slug, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Playroom;
}

export async function updatePlayroom(
  playroomId: string,
  updates: Partial<Omit<Playroom, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Playroom> {
  const client = requireClient();
  const { data, error } = await client
    .from('playrooms')
    .update(updates)
    .eq('id', playroomId)
    .select()
    .single();
  if (error) throw error;
  return data as Playroom;
}

export async function deletePlayroom(playroomId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('playrooms').delete().eq('id', playroomId);
  if (error) throw error;
}

/** Add a space to a playroom (no-op if already present). */
export async function addSpaceToPlayroom(
  playroomId: string,
  spaceId: string,
  maxSpaces = 15
): Promise<void> {
  const client = requireClient();
  const { data: existing, error: countError } = await client
    .from('playroom_spaces')
    .select('space_id', { count: 'exact' })
    .eq('playroom_id', playroomId);
  if (countError) throw countError;
  if ((existing || []).some((r: any) => r.space_id === spaceId)) return;
  if ((existing || []).length >= maxSpaces) {
    throw new Error(`A playroom can hold at most ${maxSpaces} spaces`);
  }
  const { error } = await client
    .from('playroom_spaces')
    .insert({ playroom_id: playroomId, space_id: spaceId, position: (existing || []).length });
  if (error) throw error;
}

export async function removeSpaceFromPlayroom(playroomId: string, spaceId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('playroom_spaces')
    .delete()
    .eq('playroom_id', playroomId)
    .eq('space_id', spaceId);
  if (error) throw error;
}

/** Persist a new display order for playrooms (array of playroom ids, first = top). */
export async function reorderPlayrooms(orderedPlayroomIds: string[]): Promise<void> {
  const client = requireClient();
  await Promise.all(
    orderedPlayroomIds.map((playroomId, i) =>
      client
        .from('playrooms')
        .update({ position: i })
        .eq('id', playroomId)
        .then(({ error }) => {
          if (error) throw error;
        })
    )
  );
}

/** Persist a new space order within a playroom (array of space ids, first = top). */
export async function reorderPlayroomSpaces(playroomId: string, orderedSpaceIds: string[]): Promise<void> {
  const client = requireClient();
  await Promise.all(
    orderedSpaceIds.map((spaceId, i) =>
      client
        .from('playroom_spaces')
        .update({ position: i })
        .eq('playroom_id', playroomId)
        .eq('space_id', spaceId)
        .then(({ error }) => {
          if (error) throw error;
        })
    )
  );
}

/** Upload a playroom logo; returns the public URL (does not save the playroom).
 * Reuses the board-logos bucket (its RLS already scopes uploads to the user's own folder). */
export async function uploadPlayroomLogo(userId: string, playroomId: string, file: File): Promise<string> {
  const client = requireClient();
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2MB');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/playroom-${playroomId}/logo.${ext}`;
  const { error } = await client.storage
    .from('board-logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = client.storage.from('board-logos').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
