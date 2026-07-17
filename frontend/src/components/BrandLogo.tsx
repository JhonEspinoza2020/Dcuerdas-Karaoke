import { marcaAssets } from "../shared/assets";

type Size = "hero" | "header" | "compact" | "nav";

type Props = {
  size?: Size;
  className?: string;
  showSubtitulo?: boolean;
};

const sizeClass: Record<Size, string> = {
  hero: "brand-logo--hero",
  header: "brand-logo--header",
  compact: "brand-logo--compact",
  nav: "brand-logo--nav",
};

const sizeMaxWidth: Record<Size, string> = {
  hero: "360px",
  header: "280px",
  compact: "240px",
  nav: "168px",
};

export function BrandLogo({ size = "header", className = "", showSubtitulo = false }: Props) {
  return (
    <div className={`brand-logo ${sizeClass[size]} ${className}`.trim()}>
      <img
        src={marcaAssets.logo}
        alt={marcaAssets.logoAlt}
        className="brand-logo-img"
        style={{ maxWidth: sizeMaxWidth[size], width: "100%" }}
      />
      {showSubtitulo && size === "hero" && (
        <span className="brand-logo-sub visually-hidden">{marcaAssets.logoAlt}</span>
      )}
    </div>
  );
}
