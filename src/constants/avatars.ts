// Default character avatars for profile pictures
// Cozy, family-friendly characters that fit the Littlables theme

export interface CharacterAvatar {
  id: string;
  name: string;
  emoji: string;
  bg: string; // background color for the avatar circle
}

export const CHARACTER_AVATARS: CharacterAvatar[] = [
  { id: 'fox', name: 'Foxy', emoji: '🦊', bg: '#ff8c42' },
  { id: 'bunny', name: 'Bunbun', emoji: '🐰', bg: '#f9a8d4' },
  { id: 'bear', name: 'Teddy', emoji: '🧸', bg: '#b45309' },
  { id: 'owl', name: 'Hoot', emoji: '🦉', bg: '#7c3aed' },
  { id: 'cat', name: 'Whiskers', emoji: '🐱', bg: '#f59e0b' },
  { id: 'dog', name: 'Biscuit', emoji: '🐶', bg: '#d97706' },
  { id: 'unicorn', name: 'Sprinkles', emoji: '🦄', bg: '#ec4899' },
  { id: 'turtle', name: 'Shelly', emoji: '🐢', bg: '#10b981' },
  { id: 'panda', name: 'Mochi', emoji: '🐼', bg: '#6b7280' },
  { id: 'penguin', name: 'Waddles', emoji: '🐧', bg: '#3b82f6' },
  { id: 'frog', name: 'Hoppy', emoji: '🐸', bg: '#22c55e' },
  { id: 'koala', name: 'Snuggles', emoji: '🐨', bg: '#94a3b8' },
];

export function getCharacterAvatar(id: string | null | undefined): CharacterAvatar | null {
  if (!id) return null;
  return CHARACTER_AVATARS.find((c) => c.id === id) || null;
}
