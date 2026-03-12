import { useCallback, useEffect, useState } from 'react';

interface Account {
  id: string;
  providerId: string;
  accountId: string;
  scope: string | null;
  accessTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  credential: 'Email & Password',
  google: 'Google',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts');
      if (!res.ok) throw new Error('Failed to load accounts');
      setAccounts(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();

    const params = new URLSearchParams(window.location.search);
    const linkError = params.get('error');
    if (params.get('linked') || linkError) {
      window.history.replaceState({}, '', window.location.pathname);
      if (linkError) setError(decodeURIComponent(linkError));
    }
  }, [fetchAccounts]);

  const handleUnlink = async (accountId: string) => {
    if (!confirm('Are you sure you want to unlink this account?')) return;
    setUnlinking(accountId);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Failed to unlink account');
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUnlinking(null);
    }
  };

  const handleLink = async (providerId: string) => {
    const res = await fetch(`/api/accounts/${providerId}/link`, {
      method: 'PATCH',
      redirect: 'manual',
    });
    const location = res.headers.get('location') ?? `/api/auth/${providerId}`;
    window.location.href = location;
  };

  const hasGoogle = accounts.some((a) => a.providerId === 'google');

  return (
    <div style={{ maxWidth: 480, margin: '48px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Linked Accounts</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Manage the accounts you use to sign in.</p>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#666' }}>Loading…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {accounts.map((account) => (
            <li
              key={account.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {PROVIDER_LABELS[account.providerId] ?? account.providerId}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  ID: {account.accountId}
                </div>
              </div>
              {account.providerId !== 'credential' && (
                <button
                  onClick={() => void handleUnlink(account.id)}
                  disabled={unlinking === account.id}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    padding: '6px 14px',
                    cursor: unlinking === account.id ? 'not-allowed' : 'pointer',
                    color: '#374151',
                    fontSize: 14,
                  }}
                >
                  {unlinking === account.id ? 'Unlinking…' : 'Unlink'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Link another account</h2>
        {!hasGoogle && (
          <button
            onClick={() => void handleLink('google')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '10px 20px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: '#374151',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9L37.5 9C34 5.8 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.3-7.7 19.3-19.3 0-1.3-.1-2.5-.3-3.7z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.4 15.6 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9L37.5 9C34 5.8 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.8 13.5-4.7l-6.2-5.2C29.4 35.7 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 39.7 16.3 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.2C40.8 35.4 44 30.1 44 24c0-1.3-.1-2.5-.4-4z" />
            </svg>
            Link Google
          </button>
        )}
        {hasGoogle && (
          <p style={{ color: '#6b7280', fontSize: 14 }}>All available social accounts are already linked.</p>
        )}
      </div>
    </div>
  );
}
