import { useState } from 'react';
import type { Article, DigestResponse } from '@birthdaypapers/shared';
import { client } from './api';
import { BackgroundVideo } from './BackgroundVideo';
import './App.css';

function App() {
  const [date, setDate] = useState('2000-01-01');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [articleMap, setArticleMap] = useState<Map<string, Article>>(new Map());

  const fetchArticles = async (target: string): Promise<Article[]> => {
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await client.articles.$get({ query: { date: target } });
      if (res.status === 200) {
        return (await res.json()) as Article[];
      }
      if (res.status !== 202) {
        throw new Error(`Articles HTTP ${res.status}`);
      }
      if (attempt < maxAttempts - 1) {
        const baseMs = 1000 * 2 ** attempt;
        const jitter = Math.random() * 0.3 * baseMs;
        await new Promise((r) => setTimeout(r, baseMs + jitter));
      }
    }
    throw new Error('Cache fill timed out');
  };

  const fetchDigest = async (target: string) => {
    setLoading(true);
    setError(null);
    setDigest(null);
    setArticleMap(new Map());
    try {
      const articles = await fetchArticles(target);
      setArticleMap(new Map(articles.map((a) => [a.id, a])));

      const res = await client.digest.$post({
        json: {
          articles: articles.map((a) => ({
            id: a.id,
            headline: a.headline,
            section: a.section,
          })),
          lang: 'ja',
        },
      });
      if (res.status !== 200) {
        throw new Error(`Digest HTTP ${res.status}`);
      }
      setDigest((await res.json()) as DigestResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
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
          <p className="tagline">
            Discover the headlines from your special day.
          </p>
        </header>

        <section className="card">
          <div className="controls">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              type="button"
              onClick={() => fetchDigest(date)}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Fetch'}
            </button>
          </div>

          {error && <p className="error">Error: {error}</p>}

          {digest && (
            <>
              {digest.summary && (
                <>
                  <h2 className="section-title">要約</h2>
                  <p className="digest-summary">{digest.summary}</p>
                </>
              )}
              <h2 className="section-title">主な記事</h2>
              <ul className="picks">
                {digest.picks.map((p) => {
                  const article = articleMap.get(p.id);
                  if (!article) return null;
                  return (
                    <li key={p.id}>
                      <a href={article.url} target="_blank" rel="noreferrer">
                        {article.headline}
                      </a>
                      <p className="pick-summary">{p.summary}</p>
                      <span className="meta">
                        {article.source}
                        {article.section ? ` / ${article.section}` : ''}
                        {' / '}
                        {article.date}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </main>
    </>
  );
}

export default App;
