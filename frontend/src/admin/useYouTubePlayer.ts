import { useEffect, useRef, useState } from "react";

type OnEnded = () => void;
type OnError = (code: number) => void;

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

export function useYouTubePlayer(onEnded: OnEnded, onError?: OnError) {
  const playerRef = useRef<YTPlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;
  }, [onEnded, onError]);

  useEffect(() => {
    let destroyed = false;
    waitForYT().then((YT) => {
      if (destroyed) return;
      playerRef.current = new YT.Player("yt-player", {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) onEndedRef.current();
          },
          onError: (e) => {
            onErrorRef.current?.(e.data);
          },
        },
      });
    });
    return () => {
      destroyed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const play = (videoId: string) => {
    const p = playerRef.current;
    if (!p) return;
    // Salir de modo playlist/cliente anterior antes de una canción pedida.
    p.stopVideo();
    p.loadVideoById(videoId);
    p.playVideo();
  };

  /** Radio de la casa: lista fija mezclada (nunca el video del cliente anterior). */
  const playRadio = (videoIds: string[]) => {
    const p = playerRef.current;
    if (!p || videoIds.length === 0) return;
    p.stopVideo();
    const mezclada = [...videoIds].sort(() => Math.random() - 0.5);
    p.loadPlaylist(mezclada, 0, 0);
    p.setShuffle(true);
    p.setLoop(true);
    p.playVideo();
  };

  const setVolume = (vol: number) => {
    playerRef.current?.setVolume?.(Math.max(0, Math.min(100, vol)));
  };

  const getVolume = () => playerRef.current?.getVolume?.() ?? 100;

  return { ready, play, playRadio, setVolume, getVolume };
}
