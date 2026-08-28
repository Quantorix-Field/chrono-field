/* ============================================
   SKYCANVAS
   Owns the WebGL surface. Initializes the GL
   context once, hands the render loop off to
   the engine, and tears it down cleanly on
   unmount. A caught render error never kills
   the whole app — it degrades to a static
   fallback instead.
============================================ */
import { useEffect, useRef, useState } from 'react';
import type { SkyRenderState } from '@/types';

interface SkyCanvasProps {
  state: SkyRenderState;
}

export default function SkyCanvas({ state }: SkyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<{ destroy: () => void; update: (s: SkyRenderState) => void } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Initialize the engine once — resizing and state updates are
  // handled separately below, not by re-creating the WebGL context.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    import('@/engine/renderer')
      .then(({ createRenderer }) => {
        if (cancelled) return;
        try {
          engineRef.current = createRenderer(canvas);
        } catch (err) {
          console.error('SkyCanvas: failed to initialize renderer', err);
          setRenderError('Your device may not support the visuals used here.');
        }
      })
      .catch((err) => {
        console.error('SkyCanvas: failed to load renderer module', err);
        setRenderError('Something went wrong loading the sky renderer.');
      });

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  // Push new state to the engine on every change, without touching
  // the WebGL context itself — this is what makes the slider/search
  // feel live instead of triggering a reload.
  useEffect(() => {
    try {
      engineRef.current?.update(state);
    } catch (err) {
      console.error('SkyCanvas: render update failed', err);
      setRenderError('The sky renderer hit an error and paused.');
    }
  }, [state]);

  // Keep the canvas sized to its container, at real device pixel
  // density — otherwise the render looks soft on high-DPI screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  if (renderError) {
    return (
      <div className="sky-canvas-fallback" role="img" aria-label="Sky visualization unavailable">
        <p>{renderError}</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="sky-canvas" aria-hidden="true" />;
}
