import { useEffect, useState } from 'react';
import type { Article } from '@birthdaypapers/shared';
import { client } from './api';

function App() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const maxAttempts = 6;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res = await client.articles.$get({ query: { date: target } });
        if (res.ok) {
          setArticles(await res.json());
          return;
        }
        if (res.status !== 202) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (attempt < maxAttempts - 1) {
          const baseMs = 1000 * 2 ** attempt;
          const jitter = Math.random() * 0.3 * baseMs;
          await new Promise((r) => setTimeout(r, baseMs + jitter));
        }
      }
      throw new Error('Cache fill timed out');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles(date);
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Birthday Papers</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="button" onClick={() => fetchArticles(date)} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <ul>
        {articles.map((a) => (
          <li key={a.id}>
            <a href={a.url} target="_blank" rel="noreferrer">
              {a.headline}
            </a>
            <span style={{ marginLeft: '0.5rem', color: '#666' }}>
              ({a.source} / {a.date})
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
