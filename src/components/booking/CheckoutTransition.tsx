import Link from "next/link";
import styles from "./checkout-transition.module.css";

type CheckoutTransitionProps = {
  error?: string;
  onRetry?: () => void;
};

export default function CheckoutTransition({ error, onRetry }: CheckoutTransitionProps) {
  return (
    <main className={styles.screen}>
      <div className={styles.topline} aria-hidden="true">
        <span className={styles.brandMark}>T<span>✦</span></span>
        <span className={styles.brandName}>TRIPANZA</span>
        <span className={styles.topTag}>Secure checkout</span>
      </div>

      <div className={styles.center}>
        <div className={styles.journey} aria-hidden="true">
          <span className={styles.orbit} />
          <span className={styles.orbitInner} />
          <svg className={styles.route} viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 133C82 139 72 41 137 69C193 93 178 28 226 39" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 9" />
          </svg>
          <span className={`${styles.routePoint} ${styles.routeStart}`} />
          <span className={`${styles.routePoint} ${styles.routeEnd}`} />
          <span className={styles.traveller}>➜</span>
        </div>

        <p className={styles.eyebrow}>YOUR NEXT ADVENTURE</p>
        <h1>{error ? "A quick detour." : <>Your trip is<br /><em>taking shape.</em></>}</h1>
        <p className={styles.description}>
          {error ? "We couldn’t open checkout yet. Your trip selection is still here—please try again." : "We’re confirming your departure and live fare. Your secure checkout is just ahead."}
        </p>

        {error ? (
          <div className={styles.errorBox}>
            <p role="alert">{error}</p>
            {onRetry && <button type="button" onClick={onRetry}>Try again <span aria-hidden="true">↗</span></button>}
          </div>
        ) : (
          <div className={styles.progress} role="status" aria-label="Opening secure checkout">
            <span className={styles.progressBar} aria-hidden="true" />
            <span className={styles.progressLabel}>Opening secure checkout<span className={styles.ellipsis} aria-hidden="true">...</span></span>
          </div>
        )}
      </div>

      <Link href="/?tripanza_view=all#trips" className={styles.exitLink}>Browse trips instead <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
