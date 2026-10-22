import { getSupabaseClient } from './supabaseService';
import type { PillConfig } from '../contexts/AuthContext';

export interface Board {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  theme: string | null;
  background_color: string | null;
  pills: PillConfig[];
  position: number;
  created_at: string;
  updated_at: string;
}

export type BoardInput = Pick<
  Board,
  'name' | 'slug' | 'description' | 'logo_url' | 'theme' | 'background_color' | 'pills' | 'position'
>;

/** "My Cozy Board!" -> "my-cozy-board" */
export function slugify(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'board';
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');
  return client;
}

/** All boards for a user, in display order. */
export async function getUserBoards(userId: string): Promise<Board[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('boards')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as Board[];
}

/** One board by owner's username + slug (for /@username/boardslug). */
export async function getBoardBySlug(username: string, slug: string): Promise<{ board: Board; ownerId: string } | null> {
  const client = requireClient();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;
  const { data: board, error } = await client
    .from('boards')
    .select('*')
    .eq('user_id', profile.id)
    .eq('slug', slug.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!board) return null;
  return { board: board as Board, ownerId: profile.id as string };
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
  const taken = new Set((data || []).filter((b: any) => b.id !== excludeId).map((b: any) => b.slug));
  let slug = baseSlug;
  let n = 2;
  while (taken.has(slug)) {
    const suffix = `-${n++}`;
    slug = (baseSlug.slice(0, 50 - suffix.length) + suffix).replace(/-+$/, '');
  }
  return slug;
}

export async function createBoard(userId: string, input: BoardInput): Promise<Board> {
  const client = requireClient();
  const slug = await ensureUniqueSlug(userId, input.slug);
  const { data, error } = await client
    .from('boards')
    .insert({ ...input, slug, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Board;
}

export async function updateBoard(
  boardId: string,
  updates: Partial<Omit<Board, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Board> {
  const client = requireClient();
  const { data, error } = await client.from('boards').update(updates).eq('id', boardId).select().single();
  if (error) throw error;
  return data as Board;
}

export async function deleteBoard(boardId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('boards').delete().eq('id', boardId);
  if (error) throw error;
}

/** Persist a new display order (array of board ids, first = top). */
export async function reorderBoards(orderedIds: string[]): Promise<void> {
  const client = requireClient();
  await Promise.all(
    orderedIds.map((id, i) =>
      client.from('boards').update({ position: i }).eq('id', id).then(({ error }) => {
        if (error) throw error;
      })
    )
  );
}

/** Upload a board logo; returns the public URL (does not save the board). */
export async function uploadBoardLogo(userId: string, boardId: string, file: File): Promise<string> {
  const client = requireClient();
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2MB');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${boardId}/logo.${ext}`;
  const { error } = await client.storage
    .from('board-logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = client.storage.from('board-logos').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
