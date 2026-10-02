export function isHostPath(path: string) {
  const first = path.split("/").filter(Boolean)[0];
  return first === "host" || ["host-dashboard", "admin-host-trips", "add-your-own-trip", "poster-download", "host-reels", "host-customer-booking-history", "host-payout-details", "host-wallet", "crm"].includes(first);
}
