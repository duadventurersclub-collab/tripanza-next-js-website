import type { TourDetail } from "@/lib/wp";

function formatDiscount(value: number, type: "amount" | "percent") {
  if (type === "percent") return `${value}%`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function TourAboutDiscounts({ tour }: { tour: TourDetail }) {
  const discounts = tour.details.bulk_discounts;
  const about = tour.content || tour.excerpt;

  return (
    <>
      {discounts.length > 0 ? (
        <section className="tp-bulk-discounts" aria-labelledby="tp-bulk-discounts-title">
          <header>
            <span><i className="fa-solid fa-users" aria-hidden="true" /></span>
            <div>
              <small>Travel together, save together</small>
              <h2 id="tp-bulk-discounts-title">Bulk discount</h2>
            </div>
          </header>
          <div className="tp-bulk-discounts__table" role="table" aria-label="Group booking discounts">
            <div className="tp-bulk-discounts__row tp-bulk-discounts__row--head" role="row">
              <span role="columnheader">Discount group</span>
              <span role="columnheader">Travellers</span>
              <span role="columnheader">You save</span>
            </div>
            {discounts.map((discount, index) => (
              <div className="tp-bulk-discounts__row" role="row" key={`${discount.audience}-${discount.from}-${index}`}>
                <span role="cell"><strong>{discount.title}</strong><small>{discount.audience === "quad" ? "Quad sharing" : "Triple sharing"}</small></span>
                <span role="cell">{discount.from}{discount.to !== discount.from ? `–${discount.to}` : ""}</span>
                <span role="cell"><strong>{formatDiscount(discount.value, discount.type)}</strong></span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="tp-about-tour" aria-labelledby="tp-about-tour-title">
        <span className="tp-about-tour__eyebrow">The complete plan</span>
        <h2 id="tp-about-tour-title">About this tour</h2>
        {about ? <p>{about}</p> : <p>Everything you need for this experience is organised below, from the daily plan and stay to inclusions and important trip information.</p>}
      </section>
    </>
  );
}
