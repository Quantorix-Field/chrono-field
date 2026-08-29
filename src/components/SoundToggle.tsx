/* ============================================
   SOUNDTOGGLE
   Opt-in ambient audio — never autoplays. Shows
   a one-time consent prompt; once accepted, the
   loop plays and this becomes a simple mute/
   unmute control. Consent choice persists for
   the session so it doesn't nag on every visit
   within the same tab.
============================================ */
import { useState, useRef, useEffect } from 'react';

type ConsentState = 'unasked' | 'accepted' | 'declined';

const SESSION_KEY = 'chrono-field:sound-consent';

export default function SoundToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [consent, setConsent] = useState<ConsentState>('unasked');
  const [playing, setPlaying] = useState(false);

  // Session-only memory of consent — intentionally not localStorage,
  // which would persist indefinitely across visits. A fresh session
  // gets asked again, which feels more honest than silently deciding
  // for the user based on something from days ago.
  useEffect(() => {
    const remembered = sessionStorage.getItem(SESSION_KEY) as ConsentState | null;
    if (remembered === 'accepted' || remembered === 'declined') {
      setConsent(remembered);
    }
  }, []);

  function acceptAndPlay() {
    setConsent('accepted');
    sessionStorage.setItem(SESSION_KEY, 'accepted');
    audioRef.current?.play().catch(() => {
      // Some browsers still block this despite the user gesture —
      // fail silently into the paused state rather than throwing.
      setPlaying(false);
    });
    setPlaying(true);
  }

  function decline() {
    setConsent('declined');
    sessionStorage.setItem(SESSION_KEY, 'declined');
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }

  return (
    <div className="sound-toggle">
      <audio ref={audioRef} src="/ambient-loop.mp3" loop preload="none" />

      {consent === 'unasked' && (
        <div className="sound-toggle__prompt" role="dialog" aria-label="Ambient sound">
          <p>Play a soft ambient soundscape while you explore?</p>
          <div className="sound-toggle__prompt-actions">
            <button type="button" onClick={acceptAndPlay}>
              Yes, play sound
            </button>
            <button type="button" onClick={decline} className="sound-toggle__decline">
              No thanks
            </button>
          </div>
        </div>
      )}

      {consent === 'accepted' && (
        <button
          type="button"
          onClick={toggle}
          className="sound-toggle__control"
          aria-label={playing ? 'Mute ambient sound' : 'Play ambient sound'}
          aria-pressed={playing}
        >
          {playing ? '🔊' : '🔇'}
        </button>
      )}

      {consent === 'declined' && (
        <button
          type="button"
          onClick={acceptAndPlay}
          className="sound-toggle__control"
          aria-label="Play ambient sound"
        >
          🔈
        </button>
      )}
    </div>
  );
}
