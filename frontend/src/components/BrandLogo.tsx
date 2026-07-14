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

export function BrandLogo({ size = "header", className = "", showSubtitulo = false }: Props) {
  return (
    <div className={`brand-logo ${sizeClass[size]} ${className}`.trim()}>
      <img
        src={marcaAssets.logo}
        alt={marcaAssets.logoAlt}
        className="brand-logo-img"
        style={{ maxWidth: size === "header" ? "280px" : size === "hero" ? "360px" : "240px", width: "100%" }}
      />
      {showSubtitulo && size === "hero" && (
        <span className="brand-logo-sub visually-hidden">{marcaAssets.logoAlt}</span>
      )}
    </div>
  );
}
