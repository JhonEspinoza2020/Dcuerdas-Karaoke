import { useEffect, useRef, useState } from "react";

type OnEnded = () => void;
type OnError = (code: number) => void;
type OnPlayingChange = (playing: boolean) => void;

function waitForYT(): Promise<YT> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}

function manejarEstadoPlayer(
  YT: YT,
  data: number,
  onEnded: OnEnded,
  onPlayingChange?: OnPlayingChange,
) {
  if (data === YT.PlayerState.ENDED) {
    onPlayingChange?.(false);
    onEnded();
    return;
  }
  if (data === YT.PlayerState.PAUSED) {
    onPlayingChange?.(false);
    return;
  }
  if (data === YT.PlayerState.PLAYING) {
    onPlayingChange?.(true);
  }
}

export function useYouTubePlayer(
  onEnded: OnEnded,
  onError?: OnError,
  onPlayingChange?: OnPlayingChange,
) {
  const playerRef = useRef<YTPlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onPlayingChangeRef = useRef(onPlayingChange);
  /** Solo true tras gesto en ESTA pestaña. Unmute antes = Chrome pausa el video. */
  const audioUnlockedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;
    onPlayingChangeRef.current = onPlayingChange;
  }, [onEnded, onError, onPlayingChange]);

  useEffect(() => {
    let destroyed = false;
    waitForYT().then((YT) => {
      if (destroyed) return;
      playerRef.current = new YT.Player("yt-player", {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (e) => {
            try {
              const iframe = e.target.getIframe?.();
              iframe?.setAttribute(
                "allow",
                "autoplay; encrypted-media; picture-in-picture; fullscreen",
              );
            } catch {
              /* ignore */
            }
            if (!destroyed) setReady(true);
          },
          onStateChange: (e) => {
            manejarEstadoPlayer(
              YT,
              e.data,
              () => onEndedRef.current(),
              onPlayingChangeRef.current,
            );
          },
          onError: (e) => {
            onPlayingChangeRef.current?.(false);
            onErrorRef.current?.(e.data);
          },
        },
      });
    });
    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, []);

  const aplicarSonidoSiLibre = () => {
    if (!audioUnlockedRef.current) return;
    const p = playerRef.current;
    if (!p) return;
    try {
      p.unMute?.();
      if ((p.getVolume?.() ?? 0) < 5) p.setVolume?.(100);
    } catch {
      /* ignore */
    }
  };

  /**
   * Siempre mute + play. NUNCA unMute aquí: si no hay gesto, Chrome pausa
   * y queda el ▶ rojo (parece “video malo” y antes saltaba en bucle).
   */
  const play = (videoId: string, startSeconds = 0, _preferUnmuted = false) => {
    const p = playerRef.current;
    if (!p?.loadVideoById) return;
    if (startSeconds > 1) {
      p.loadVideoById({ videoId, startSeconds });
    } else {
      p.loadVideoById(videoId);
    }

    const mutePlay = (n: number) => {
      try {
        p.mute?.();
        p.playVideo?.();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        try {
          const st = p.getPlayerState?.() ?? -1;
          if (st === 1 || st === 3) {
            // Video corriendo (muted). Sonido solo si ya hubo gesto.
            aplicarSonidoSiLibre();
            return;
          }
          if (n < 16) mutePlay(n + 1);
        } catch {
          if (n < 16) mutePlay(n + 1);
        }
      }, 70 + n * 50);
    };

    window.setTimeout(() => mutePlay(0), 30);
  };

  const resume = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.mute?.();
      p.playVideo?.();
      aplicarSonidoSiLibre();
    } catch {
      /* ignore */
    }
  };

  /** Llamar solo desde gesto real en la pestaña del player. */
  const unlockAudio = () => {
    audioUnlockedRef.current = true;
    const p = playerRef.current;
    if (!p) return;
    try {
      p.unMute?.();
      if ((p.getVolume?.() ?? 0) < 5) p.setVolume?.(100);
      const st = p.getPlayerState?.() ?? -1;
      if (st !== 1 && st !== 3) {
        p.playVideo?.();
      }
    } catch {
      /* ignore */
    }
  };

  const pause = () => {
    playerRef.current?.pauseVideo?.();
  };

  const stop = () => {
    try {
      playerRef.current?.stopVideo?.();
    } catch {
      /* ignore */
    }
  };

  const mute = () => {
    try {
      playerRef.current?.mute?.();
    } catch {
      /* ignore */
    }
  };

  const unMute = () => {
    // Compat: solo suena si ya hubo unlock; si no, no arriesgar pausa.
    if (audioUnlockedRef.current) aplicarSonidoSiLibre();
  };

  const setVolume = (vol: number) => {
    playerRef.current?.setVolume?.(Math.max(0, Math.min(100, vol)));
  };

  const getVolume = () => playerRef.current?.getVolume?.() ?? 100;

  const getPlayerState = () => playerRef.current?.getPlayerState?.() ?? -1;

  const getCurrentTime = () => {
    try {
      return playerRef.current?.getCurrentTime?.() ?? 0;
    } catch {
      return 0;
    }
  };

  const isMuted = () => {
    try {
      return playerRef.current?.isMuted?.() ?? true;
    } catch {
      return true;
    }
  };

  return {
    ready,
    play,
    resume,
    pause,
    stop,
    mute,
    unMute,
    unlockAudio,
    setVolume,
    getVolume,
    getPlayerState,
    getCurrentTime,
    isMuted,
  };
}
