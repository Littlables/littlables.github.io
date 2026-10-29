import { getSupabaseClient } from './supabaseService';
import type { PillConfig, Profile } from '../contexts/AuthContext';
import { trackSpaceCreated } from './trackingService';
import { extractSingleEmoji, getSavedEmojiOverrides, setSavedEmojiOverride } from './spaceEmojiService';

export interface Space {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  icon_emoji?: string | null;
  theme: string | null;
  background_color: string | null;
  pills: PillConfig[];
  position: number;
  created_at: string;
  updated_at: string;
}

export type SpaceInput = Pick<
  Space,
  'name' | 'slug' | 'description' | 'logo_url' | 'theme' | 'background_color' | 'pills' | 'position'
> & {
  icon_emoji?: string | null;
};

export function hydrateSpaceEmoji(space: Space): Space {
  const validDbEmoji = extractSingleEmoji(space.icon_emoji);
  if (validDbEmoji) {
    return space.icon_emoji === validDbEmoji ? space : { ...space, icon_emoji: validDbEmoji };
  }
  const local = extractSingleEmoji(getSavedEmojiOverrides()[space.id]);
  if (local) {
    return { ...space, icon_emoji: local };
  }
  return space.icon_emoji ? { ...space, icon_emoji: null } : space;
}

/** "My Cozy Space!" -> "my-cozy-space" */
export function slugify(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 50) || 'space';
}

/**
 * Typing-friendly slug sanitizer for URL inputs: lowercases and strips
 * characters outside a-z 0-9 - _, but never rewrites or replaces what the
 * user typed — safe to run on every keystroke (full slugify runs on save).
 */
export function sanitizeSlugInput(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 50);
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');
  return client;
}

/** All spaces for a user, in display order. */
export async function getUserSpaces(userId: string): Promise<Space[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('boards')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data || []) as Space[]).map(hydrateSpaceEmoji);
}

/** One space by owner's username + slug (for /@username/spaces/spaceslug). */
export async function getSpaceBySlug(
  username: string,
  slug: string
): Promise<{ space: Space; ownerId: string; owner: Profile } | null> {
  const client = requireClient();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;
  const { data: space, error } = await client
    .from('boards')
    .select('*')
    .eq('user_id', profile.id)
    .eq('slug', slug.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!space) return null;
  return {
    space: hydrateSpaceEmoji(space as Space),
    ownerId: profile.id as string,
    owner: profile as Profile,
  };
}

/** Ensure the slug is unique for this user (appends -2, -3, ...). */
export async function ensureUniqueSlug(
  userId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.from('boards').select('id, slug').eq('user_id', userId);
  if (error) throw error;
  const taken = new Set((data || []).filter((s: any) => s.id !== excludeId).map((s: any) => s.slug));
  let slug = baseSlug;
  let n = 2;
  while (taken.has(slug)) {
    const suffix = `-${n++}`;
    slug = (baseSlug.slice(0, 50 - suffix.length) + suffix).replace(/-+$/, '');
  }
  return slug;
}

export async function createSpace(userId: string, input: SpaceInput): Promise<Space> {
  const client = requireClient();
  const slug = await ensureUniqueSlug(userId, input.slug);
  const sanitizedInput: SpaceInput =
    input.icon_emoji !== undefined
      ? { ...input, icon_emoji: extractSingleEmoji(input.icon_emoji) || null }
      : input;
  let { data, error } = await client
    .from('boards')
    .insert({ ...sanitizedInput, slug, user_id: userId })
    .select()
    .single();
  if (error && String(error.message || '').includes('icon_emoji')) {
    const { icon_emoji: _ignored, ...restInput } = sanitizedInput;
    const retry = await client
      .from('boards')
      .insert({ ...restInput, slug, user_id: userId })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  const created = data as Space;
  if (sanitizedInput.icon_emoji !== undefined) {
    setSavedEmojiOverride(created.id, sanitizedInput.icon_emoji);
    created.icon_emoji = sanitizedInput.icon_emoji || null;
  }
  // Anonymous analytics: which pills users build spaces from (no user_id, no name)
  trackSpaceCreated(input.pills || []);
  return hydrateSpaceEmoji(created);
}

export async function updateSpace(
  spaceId: string,
  updates: Partial<Omit<Space, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Space> {
  const client = requireClient();
  const sanitizedUpdates =
    updates.icon_emoji !== undefined
      ? { ...updates, icon_emoji: extractSingleEmoji(updates.icon_emoji) || null }
      : updates;
  let { data, error } = await client.from('boards').update(sanitizedUpdates).eq('id', spaceId).select().single();
  if (error && String(error.message || '').includes('icon_emoji')) {
    const { icon_emoji: _ignored, ...restUpdates } = sanitizedUpdates;
    const retry = await client.from('boards').update(restUpdates).eq('id', spaceId).select().single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  const updated = data as Space;
  if (sanitizedUpdates.icon_emoji !== undefined) {
    setSavedEmojiOverride(spaceId, sanitizedUpdates.icon_emoji);
    updated.icon_emoji = sanitizedUpdates.icon_emoji || null;
  }
  return hydrateSpaceEmoji(updated);
}

export async function deleteSpace(spaceId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('boards').delete().eq('id', spaceId);
  if (error) throw error;
}

/** Persist a new display order (array of space ids, first = top). */
export async function reorderSpaces(orderedSpaceIds: string[]): Promise<void> {
  const client = requireClient();
  await Promise.all(
    orderedSpaceIds.map((spaceId, i) =>
      client.from('boards').update({ position: i }).eq('id', spaceId).then(({ error }) => {
        if (error) throw error;
      })
    )
  );
}

/** Upload a space logo; returns the public URL (does not save the space). */
export async function uploadSpaceLogo(userId: string, spaceId: string, file: File): Promise<string> {
  const client = requireClient();
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2MB');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${spaceId}/logo.${ext}`;
  const { error } = await client.storage
    .from('board-logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = client.storage.from('board-logos').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
