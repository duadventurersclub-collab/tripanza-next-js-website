export default function DashboardLoading() {
  return (
    <section className="tp-bookings tp-bookings-loading" aria-label="Loading your bookings" aria-busy="true">
      <header className="tp-bookings-intro">
        <div><span>TRIP CONTROL</span><h1>Your escapes.<br /><em>Loading…</em></h1></div>
        <div className="tp-bookings-count tp-bookings-skeleton-count" aria-hidden="true" />
      </header>
      <div className="tp-bookings-loading-card" aria-hidden="true">
        <div className="tp-bookings-loading-media" />
        <div className="tp-bookings-loading-copy"><i /><i /><i /></div>
      </div>
    </section>
  );
}
