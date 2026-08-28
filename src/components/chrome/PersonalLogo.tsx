import styles from "./PersonalLogo.module.css";

type PersonalLogoProps = {
  title: string;
  logoUrl: string | null;
};

/**
 * The centred personal mark. Renders the Sanity-managed SVG (as a
 * currentColor mask so it follows the theme) or a typographic wordmark
 * fallback when no logo is uploaded.
 */
export function PersonalLogo({ title, logoUrl }: PersonalLogoProps) {
  if (logoUrl) {
    return (
      <span
        className={styles.mark}
        style={{ maskImage: `url(${logoUrl})`, WebkitMaskImage: `url(${logoUrl})` }}
        role="img"
        aria-label={title}
      />
    );
  }
  return <span className={styles.wordmark}>{title}</span>;
}
