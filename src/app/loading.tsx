export default function Loading() {
  return (
    <main className="tp-route-loading" role="status" aria-live="polite" aria-label="Loading page">
      <div className="tp-route-loading__mark" aria-hidden="true"><span /><span /><span /></div>
      <span className="tp-route-loading__name">Tripanza</span>
      <p>Getting your next stop ready…</p>
    </main>
  );
}
