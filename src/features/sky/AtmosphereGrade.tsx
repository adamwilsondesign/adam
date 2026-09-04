import styles from "./AtmosphereGrade.module.css";

/**
 * The shared photographic grade over the environment: ~2% static grain, a
 * restrained vignette and soft low-frequency haze. It sits above the
 * environmental rendering (clouds, orb, stars, the About scene) and below
 * every UI surface and client logo, which stay crisp and unaffected. Pure
 * CSS — nothing animates, nothing costs a frame.
 */
export function AtmosphereGrade() {
  return <div className={styles.grade} aria-hidden data-atmosphere-grade />;
}
