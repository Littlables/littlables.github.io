import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * List of falling emojis — starts with all Halloween and candy emojis first.
 */
export const FALLING_EMOJI_LIST: string[] = [
  // Halloween & Candy emojis first
  '🎃', '🍬', '👻', '🍭', '🍫', '🦇', '🕷️', '🕸️',
  '🧙‍♀️', '🧛', '🧟', '💀', '☠️', '🕯️', '🐈‍⬛', '🦉',
  '🌕', '🍂', '🔮', '🧪', '🧹', '👾', '👽', '👹',
  '🧁', '🍪', '🍩', '🍎', '🍯', '🍡', '🍰', '🎂',
  '🥧', '🍨', '🍧', '🍦', '🍓', '🍒',
  // Additional playful treats & party emojis
  '🎈', '⭐', '✨', '🌈', '🦄', '🧸', '🎀', '🎉',
];

interface ActiveEmoji {
  id: number;
  emoji: string;
  /** Base horizontal position in [0.05, 0.95] of viewport width */
  baseXRatio: number;
  /** Current Y in px (viewport coordinates) */
  y: number;
  /** Current X in px (viewport coordinates) */
  x: number;
  /** Vertical speed in px/second */
  speedY: number;
  /** Horizontal sway amplitude in px */
  swayAmp: number;
  /** Horizontal sway frequency in rad/second */
  swayFreq: number;
  /** Initial sway phase in radians */
  swayPhase: number;
  /** Rotation in degrees */
  rotation: number;
  /** Rotation speed in deg/second */
  rotationSpeed: number;
  /** Font size in px */
  size: number;
  /** Elapsed time in seconds */
  elapsed: number;
  /** Prevent double-collection */
  collected: boolean;
}

interface PopEffect {
  id: number;
  x: number;
  y: number;
  emoji: string;
}

interface FallingEmojisProps {
  onCollect: (emoji: string) => void;
  enabled?: boolean;
}

const MAX_ACTIVE_EMOJIS = 9;
const SPAWN_INTERVAL_MS = 1050;
const HIT_RADIUS_PX = 38;

export const FallingEmojis: React.FC<FallingEmojisProps> = ({ onCollect, enabled = true }) => {
  const [, setRenderTick] = useState(0);
  const [pops, setPops] = useState<PopEffect[]>([]);

  const activeRef = useRef<ActiveEmoji[]>([]);
  const nodeMapRef = useRef<Map<number, HTMLSpanElement>>(new Map());
  const nextIdRef = useRef(1);
  const emojiCursorIndexRef = useRef(0);
  const onCollectRef = useRef(onCollect);
  onCollectRef.current = onCollect;

  // Hoisted so a tap directly on an emoji span can collect it AND stop the
  // event there. Previously the spans had pointer-events: none, so a tap's
  // target was whatever story card sat underneath, and the tap opened it.
  const collectEmoji = useCallback((item: ActiveEmoji) => {
    if (item.collected) return;
    item.collected = true;
    const popId = nextIdRef.current++;
    const popX = item.x;
    const popY = item.y;
    const popEmoji = item.emoji;

    activeRef.current = activeRef.current.filter((e) => e.id !== item.id);
    nodeMapRef.current.delete(item.id);
    setRenderTick((t) => t + 1);

    onCollectRef.current(popEmoji);

    setPops((prev) => [...prev, { id: popId, x: popX, y: popY, emoji: popEmoji }]);
    window.setTimeout(() => {
      setPops((prev) => prev.filter((p) => p.id !== popId));
    }, 650);
  }, []);

  const collectEmojiById = useCallback(
    (id: number) => {
      const item = activeRef.current.find((e) => e.id === id);
      if (item) collectEmoji(item);
    },
    [collectEmoji],
  );

  // Track current mouse pointer so an emoji falling directly onto a stationary cursor also collects
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });

  useEffect(() => {
    if (!enabled) {
      activeRef.current = [];
      nodeMapRef.current.clear();
      setPops([]);
      setRenderTick((t) => t + 1);
      return;
    }

    const pickNextEmoji = (): string => {
      const idx = emojiCursorIndexRef.current % FALLING_EMOJI_LIST.length;
      emojiCursorIndexRef.current += 1;
      return FALLING_EMOJI_LIST[idx];
    };

    const createEmoji = (initialY?: number): ActiveEmoji => {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const baseXRatio = 0.06 + Math.random() * 0.88;
      const size = 26 + Math.round(Math.random() * 10); // 26px - 36px
      const swayPhase = Math.random() * Math.PI * 2;
      const swayAmp = 16 + Math.random() * 26;
      const x = baseXRatio * vw + Math.sin(swayPhase) * swayAmp;
      return {
        id: nextIdRef.current++,
        emoji: pickNextEmoji(),
        baseXRatio,
        y: initialY ?? -44,
        x,
        speedY: 58 + Math.random() * 48, // 58 - 106 px/sec
        swayAmp,
        swayFreq: 1.1 + Math.random() * 1.2,
        swayPhase,
        rotation: (Math.random() - 0.5) * 24,
        rotationSpeed: (Math.random() - 0.5) * 38,
        size,
        elapsed: 0,
        collected: false,
      };
    };

    // Seed a few initial Halloween & candy emojis staggered near the top so they appear immediately
    const initialBatch: ActiveEmoji[] = [
      createEmoji(-20),
      createEmoji(-95),
      createEmoji(-180),
    ];
    activeRef.current = initialBatch;
    setRenderTick((t) => t + 1);

    const checkHitAtPoint = (clientX: number, clientY: number) => {
      const list = activeRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        if (item.collected || item.y < -10) continue;
        const dx = clientX - item.x;
        const dy = clientY - item.y;
        const hitRadius = Math.max(HIT_RADIUS_PX, item.size * 0.95);
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          collectEmoji(item);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.active = true;
      checkHitAtPoint(e.clientX, e.clientY);
    };

    const handlePointerMove = (e: PointerEvent) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
      pointerRef.current.active = true;
      checkHitAtPoint(e.clientX, e.clientY);
    };

    const handlePointerDown = (e: PointerEvent) => {
      checkHitAtPoint(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        checkHitAtPoint(touch.clientX, touch.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        checkHitAtPoint(touch.clientX, touch.clientY);
      }
    };

    const handleMouseLeave = () => {
      pointerRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // Periodic spawner
    const spawnTimer = window.setInterval(() => {
      if (document.hidden) return;
      if (activeRef.current.length < MAX_ACTIVE_EMOJIS) {
        activeRef.current.push(createEmoji(-44));
        setRenderTick((t) => t + 1);
      }
    }, SPAWN_INTERVAL_MS);

    // Animation loop
    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.06, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let removedAny = false;

      for (let i = activeRef.current.length - 1; i >= 0; i--) {
        const item = activeRef.current[i];
        if (item.collected) continue;

        item.elapsed += dt;
        item.y += item.speedY * dt;
        const rawX =
          item.baseXRatio * vw +
          Math.sin(item.elapsed * item.swayFreq + item.swayPhase) * item.swayAmp;
        item.x = Math.max(20, Math.min(vw - 20, rawX));
        item.rotation += item.rotationSpeed * dt;

        // If cursor is resting on the page and the emoji falls onto it, collect it
        if (pointerRef.current.active && item.y >= 0) {
          const dx = pointerRef.current.x - item.x;
          const dy = pointerRef.current.y - item.y;
          const hitRadius = Math.max(HIT_RADIUS_PX, item.size * 0.95);
          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
            collectEmoji(item);
            continue;
          }
        }

        // Remove once it falls past the bottom of the screen
        if (item.y > vh + 50) {
          activeRef.current.splice(i, 1);
          nodeMapRef.current.delete(item.id);
          removedAny = true;
          continue;
        }

        const el = nodeMapRef.current.get(item.id);
        if (el) {
          el.style.transform = `translate3d(${(item.x - item.size / 2).toFixed(1)}px, ${(
            item.y -
            item.size / 2
          ).toFixed(1)}px, 0) rotate(${item.rotation.toFixed(1)}deg)`;
        }
      }

      if (removedAny) {
        setRenderTick((t) => t + 1);
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      window.clearInterval(spawnTimer);
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="falling-emojis-layer" aria-hidden="true">
      {activeRef.current.map((item) => (
        <span
          key={item.id}
          ref={(el) => {
            if (el) {
              nodeMapRef.current.set(item.id, el);
              el.style.transform = `translate3d(${(item.x - item.size / 2).toFixed(1)}px, ${(
                item.y -
                item.size / 2
              ).toFixed(1)}px, 0) rotate(${item.rotation.toFixed(1)}deg)`;
            } else {
              nodeMapRef.current.delete(item.id);
            }
          }}
          className="falling-emoji-item"
          onPointerDown={(e) => {
            // The span is now the tap target (pointer-events: auto), so the
            // tap never reaches the story card underneath. preventDefault
            // also suppresses the synthetic click a tap would otherwise fire.
            e.preventDefault();
            e.stopPropagation();
            collectEmojiById(item.id);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          style={{
            fontSize: `${item.size}px`,
            width: `${item.size}px`,
            height: `${item.size}px`,
          }}
        >
          {item.emoji}
        </span>
      ))}

      {pops.map((pop) => (
        <span
          key={pop.id}
          className="falling-emoji-pop"
          style={{
            left: `${pop.x}px`,
            top: `${pop.y}px`,
          }}
        >
          <span className="falling-emoji-pop-glyph">{pop.emoji}</span>
          <span className="falling-emoji-pop-plus">+1</span>
        </span>
      ))}
    </div>
  );
};
