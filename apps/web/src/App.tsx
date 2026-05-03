import { useState } from 'react';
import type { Article } from '@birthdaypapers/shared';
import { client } from './api';
import { BackgroundVideo } from './BackgroundVideo';
import './App.css';

function App() {
  const [date, setDate] = useState('2000-01-01');
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
        if (res.status === 200) {
          const data = (await res.json()) as Article[];
          setArticles(data);
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

  return (
    <>
      <BackgroundVideo />
      <main className="page">
        <header className="hero">
          <h1>Birthday Papers</h1>
        </header>

        <section className="card">
          <div className="controls">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button type="button" onClick={() => fetchArticles(date)} disabled={loading}>
              {loading ? 'Loading...' : 'Fetch'}
            </button>
          </div>

          {error && <p className="error">Error: {error}</p>}

          <ul className="articles">
            {articles.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noreferrer">
                  {a.headline}
                </a>
                <span className="meta">
                  {a.source} / {a.date}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

export default App;
