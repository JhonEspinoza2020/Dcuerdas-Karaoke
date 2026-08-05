type Props = {
  videoId?: string;
  className?: string;
  /** Si true, solo muestra atribución general sin enlace a un video. */
  soloMarca?: boolean;
};

/**
 * Atribución YouTube + enlace al video en YouTube.com (políticas de API Client).
 */
export function YoutubeAttribution({ videoId, className = "", soloMarca }: Props) {
  if (soloMarca || !videoId) {
    return (
      <p className={`yt-attr ${className}`.trim()}>
        Búsqueda con{" "}
        <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer">
          YouTube
        </a>
      </p>
    );
  }

  const href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  return (
    <a
      className={`yt-watch-link ${className}`.trim()}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      Ver en YouTube
    </a>
  );
}
