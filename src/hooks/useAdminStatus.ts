import { useEffect, useState } from 'react';

const WORKER_URL = 'https://hello-ai.cryptokatiee.workers.dev';

/**
 * Checks if the user has an active GitHub admin session.
 * Uses credentials:include so the worker's session cookie is sent.
 */
export function useAdminStatus() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLogin, setAdminLogin] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const resp = await fetch(`${WORKER_URL}/admin/api/identity`, {
          credentials: 'include',
        });
        if (!cancelled && resp.ok) {
          const data = await resp.json();
          if (data.login) {
            setIsAdmin(true);
            setAdminLogin(data.login);
          }
        }
      } catch {
        // Not admin or network error — silently ignore
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  return { isAdmin, adminLogin, checking };
}
