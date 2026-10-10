// Only publisher-documented, automatic AI crawlers are controlled here.
// User-requested fetchers may not honor robots.txt and are intentionally excluded.
export const AI_SEARCH_BOTS = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"] as const;
export const AI_TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended"] as const;

export const PRIVATE_ROBOT_PATHS: string[] = [
  "/api/", "/admin", "/account", "/checkout", "/cart", "/payment", "/booking",
  "/login", "/dashboard", "/host-dashboard", "/host-wallet", "/host-payout-details",
  "/host-customer-booking-history", "/host-reels", "/crm", "/poster-download",
  "/add-your-own-trip",
];

export function buildRobotsRules(searchEnabled: boolean, trainingEnabled: boolean) {
  const rules: { userAgent: string; allow?: string; disallow: string | string[] }[] = [
    { userAgent: "*", allow: "/", disallow: PRIVATE_ROBOT_PATHS },
  ];
  // An enabled bot inherits the wildcard's public allow/private disallow policy.
  // A disabled bot gets its own more-specific, site-wide disallow group.
  if (!searchEnabled) rules.push(...AI_SEARCH_BOTS.map(userAgent => ({ userAgent, disallow: "/" })));
  if (!trainingEnabled) rules.push(...AI_TRAINING_BOTS.map(userAgent => ({ userAgent, disallow: "/" })));
  return rules;
}
