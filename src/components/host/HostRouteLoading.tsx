import "./route-loading.css";

export default function HostRouteLoading() {
  return <main className="host-route-loading" role="status" aria-live="polite" aria-label="Loading host page">
    <div className="host-route-loading__shell">
      <div className="host-route-loading__top"><span className="host-route-loading__brand">T</span><span className="host-route-loading__line short" /></div>
      <div className="host-route-loading__eyebrow">TRIPANZA HOST MODE</div>
      <h1>Getting your crew ready<span className="host-route-loading__dots" aria-hidden="true">...</span></h1>
      <div className="host-route-loading__cards" aria-hidden="true"><span /><span /><span /><span /></div>
      <span className="host-route-loading__line long" aria-hidden="true" />
    </div>
  </main>;
}
