import { useEffect, useRef, useState } from 'react';

const VIDEOS = [
  '/videos/mov-bird.mp4',
  '/videos/mov-city.mp4',
  '/videos/mov-finance.mp4',
  '/videos/mov-nature.mp4',
  '/videos/mov-war.mp4',
];

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function BackgroundVideo() {
  const [order] = useState(() => shuffled(VIDEOS));
  const [index, setIndex] = useState(0);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const slotRefs: [
    React.RefObject<HTMLVideoElement | null>,
    React.RefObject<HTMLVideoElement | null>,
  ] = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [sources, setSources] = useState<[string, string]>([
    order[0],
    order[1 % order.length],
  ]);

  useEffect(() => {
    const current = slotRefs[activeSlot].current;
    if (!current) return;
    const handleEnded = () => {
      const nextIndex = (index + 1) % order.length;
      const nextSlot: 0 | 1 = activeSlot === 0 ? 1 : 0;
      const upcoming = order[(nextIndex + 1) % order.length];
      const fadingSlot = activeSlot;

      setIndex(nextIndex);
      setActiveSlot(nextSlot);
      const nextEl = slotRefs[nextSlot].current;
      if (nextEl) {
        nextEl.currentTime = 0;
        void nextEl.play();
      }

      window.setTimeout(() => {
        setSources((prev) => {
          const next: [string, string] = [...prev] as [string, string];
          next[fadingSlot] = upcoming;
          return next;
        });
      }, 1400);
    };
    current.addEventListener('ended', handleEnded);
    return () => current.removeEventListener('ended', handleEnded);
  }, [activeSlot, index, order]);

  return (
    <div className="bg-video">
      <video
        ref={slotRefs[0]}
        src={sources[0]}
        autoPlay
        muted
        playsInline
        preload="auto"
        className={activeSlot === 0 ? 'is-active' : ''}
      />
      <video
        ref={slotRefs[1]}
        src={sources[1]}
        muted
        playsInline
        preload="auto"
        className={activeSlot === 1 ? 'is-active' : ''}
      />
      <div className="bg-video__overlay" />
    </div>
  );
}
