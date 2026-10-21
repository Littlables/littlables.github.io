import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileDialog({ isOpen, onClose }: ProfileDialogProps) {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile?.display_name || '');
      setError('');
      setSaved(false);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim() || null });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    }
  };

  const initial = (profile?.display_name || user?.email || '?')[0].toUpperCase();

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog profile-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 className="dialog-title">Your Profile</h2>

        {error && <div className="dialog-error">{error}</div>}
        {saved && <div className="dialog-success">Saved!</div>}

        <div className="profile-avatar-row">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar-fallback">{initial}</div>
          )}
          <div className="profile-email">{user?.email}</div>
        </div>

        <form onSubmit={handleSave} className="sign-in-form">
          <label htmlFor="profile-name">Display name</label>
          <input
            id="profile-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What should we call you?"
            maxLength={50}
          />
          <button type="submit" className="sign-in-button primary-button" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>

        <button type="button" className="sign-in-button secondary-button" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
