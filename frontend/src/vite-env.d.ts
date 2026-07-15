/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface YTPlayer {
  loadVideoById(videoId: string): void;
  loadPlaylist(
    playlistOrOptions: string[] | { list: string; listType: string; index?: number },
    index?: number,
    startSeconds?: number,
  ): void;
  stopVideo(): void;
  pauseVideo(): void;
  playVideo(): void;
  mute(): void;
  getPlayerState(): number;
  setShuffle(shufflePlaylist: boolean): void;
  setLoop(loopPlaylist: boolean): void;
  nextVideo(): void;
  setVolume(volume: number): void;
  getVolume(): number;
  destroy(): void;
}

interface YTPlayerEvent {
  data: number;
  target: YTPlayer;
}

interface YT {
  Player: new (
    elementId: string | HTMLElement,
    config: {
      height: string;
      width: string;
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onStateChange?: (e: YTPlayerEvent) => void;
        onReady?: (e: YTPlayerEvent) => void;
        onError?: (e: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

interface Window {
  YT?: YT;
  onYouTubeIframeAPIReady?: () => void;
}
