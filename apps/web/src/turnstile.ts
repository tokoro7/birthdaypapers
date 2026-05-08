type RenderOptions = {
  sitekey: string;
  size?: 'invisible' | 'normal' | 'compact' | 'flexible';
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
};

type TurnstileApi = {
  render: (
    container: string | HTMLElement,
    options: RenderOptions,
  ) => string | undefined;
  reset: (widgetIdOrContainer: string | HTMLElement) => void;
  remove: (widgetIdOrContainer: string | HTMLElement) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
if (!SITE_KEY) {
  throw new Error('VITE_TURNSTILE_SITE_KEY is not set');
}

type Subscriber = {
  resolve: (token: string) => void;
  reject: (err: Error) => void;
};

let currentWidgetId: string | null = null;
let cachedToken: string | null = null;
let waiters: Subscriber[] = [];
let isGenerating = false;

const handleToken = (token: string) => {
  isGenerating = false;
  if (waiters.length > 0) {
    const next = waiters.shift()!;
    next.resolve(token);
    if (waiters.length > 0 && currentWidgetId && window.turnstile) {
      isGenerating = true;
      window.turnstile.reset(currentWidgetId);
    }
  } else {
    cachedToken = token;
  }
};

const handleError = () => {
  isGenerating = false;
  cachedToken = null;
  const err = new Error('Turnstile verification error');
  for (const w of waiters) w.reject(err);
  waiters = [];
};

const handleExpired = () => {
  cachedToken = null;
};

const waitForScript = (timeoutMs = 10_000): Promise<TurnstileApi> =>
  new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.turnstile) {
        clearInterval(timer);
        resolve(window.turnstile);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Turnstile script did not load'));
      }
    }, 50);
  });

export const mountTurnstileWidget = async (
  container: HTMLElement,
): Promise<() => void> => {
  const api = await waitForScript();
  if (currentWidgetId) {
    try {
      api.remove(currentWidgetId);
    } catch {
      // ignore — widget may have already been removed
    }
    currentWidgetId = null;
  }
  const id = api.render(container, {
    sitekey: SITE_KEY,
    theme: 'auto',
    callback: handleToken,
    'error-callback': handleError,
    'expired-callback': handleExpired,
  });
  if (!id) throw new Error('Turnstile render failed');
  currentWidgetId = id;
  isGenerating = true;

  return () => {
    if (window.turnstile) {
      window.turnstile.remove(id);
    }
    if (currentWidgetId === id) {
      currentWidgetId = null;
    }
    isGenerating = false;
    cachedToken = null;
  };
};

export const getTurnstileToken = (): Promise<string> => {
  if (cachedToken) {
    const t = cachedToken;
    cachedToken = null;
    return Promise.resolve(t);
  }
  return new Promise<string>((resolve, reject) => {
    waiters.push({ resolve, reject });
    if (!isGenerating && currentWidgetId && window.turnstile) {
      isGenerating = true;
      window.turnstile.reset(currentWidgetId);
    }
  });
};
