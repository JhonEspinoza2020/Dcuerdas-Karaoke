/**
 * Prueba real del embed (mismo dominio que el local).
 * La Data API marca LatinAutor como OK; solo el player revela el bloqueo.
 */

function ensureYtApi(): Promise<NonNullable<Window["YT"]>> {
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

/**
 * @returns true si el video llega a reproducirse embebido en este origen.
 */
export async function verificarEmbedYoutube(videoId: string, timeoutMs = 7000): Promise<boolean> {
  const id = videoId.trim();
  if (id.length < 6) return false;

  const YT = await ensureYtApi();
  const host = document.createElement("div");
  const elId = `yt-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  host.id = elId;
  host.style.cssText =
    "position:fixed;left:-9999px;top:0;width:120px;height:80px;opacity:0;pointer-events:none;";
  document.body.appendChild(host);

  return new Promise<boolean>((resolve) => {
    let done = false;
    let player: YTPlayer | null = null;
    let timer: number | undefined;
    let poll: number | undefined;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      if (timer) window.clearTimeout(timer);
      if (poll) window.clearInterval(poll);
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
      host.remove();
      resolve(ok);
    };

    player = new YT.Player(elId, {
      height: "80",
      width: "120",
      videoId: id,
      playerVars: {
        autoplay: 1,
        controls: 0,
        mute: 1,
        playsinline: 1,
        rel: 0,
        fs: 0,
        modestbranding: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (e) => {
          try {
            e.target.mute?.();
            e.target.playVideo?.();
          } catch {
            /* ignore */
          }
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING) {
            finish(true);
          }
        },
        onError: () => finish(false),
      },
    });

    poll = window.setInterval(() => {
      try {
        const st = player?.getPlayerState?.();
        if (st === YT.PlayerState.PLAYING || st === YT.PlayerState.BUFFERING) {
          finish(true);
        }
      } catch {
        /* ignore */
      }
    }, 400);

    timer = window.setTimeout(() => finish(false), timeoutMs);
  });
}
