export type HostTheme = { name: string; colors: [string, string, string, string]; dark: [string, string, string, string]; style: string };

const classic = "classic";
export const hostThemes: Record<string, HostTheme> = {
  default: { name: "Tripanza default", colors: ["#3157d5", "#d0e562", "#151925", "#f8f9fc"], dark: ["#151925", "#20284a", "#f8f9fc", "#1b2340"], style: classic },
  "sage-sand": { name: "Sage & Sand", colors: ["#8ca986", "#eadfcf", "#344e41", "#fbfaf6"], dark: ["#344e41", "#45614e", "#eadfcf", "#3d5848"], style: classic },
  "cloud-strawberry": { name: "Cloud Strawberry", colors: ["#f15596", "#f0eee9", "#392b35", "#fffafb"], dark: ["#392b35", "#553343", "#f0eee9", "#472f3c"], style: classic },
  "cream-forest": { name: "Cream & Forest", colors: ["#2d6a4f", "#faf3e0", "#1b4332", "#fffdf8"], dark: ["#1b4332", "#24513d", "#faf3e0", "#203f31"], style: classic },
  "earthy-warm": { name: "Earthy & Warm", colors: ["#606c38", "#dda15e", "#283618", "#fefae0"], dark: ["#283618", "#3b4922", "#fefae0", "#323f1d"], style: classic },
  "creative-energy": { name: "Creative Energy", colors: ["#ff4d6d", "#ffb703", "#8338ec", "#fff8fa"], dark: ["#111111", "#2a1834", "#fff8fa", "#211526"], style: classic },
  "ocean-mist": { name: "Ocean Mist", colors: ["#167d9a", "#a8dadc", "#123047", "#f4fbfc"], dark: ["#123047", "#164762", "#f4fbfc", "#143c54"], style: classic },
  "sunset-clay": { name: "Sunset Clay", colors: ["#b85c38", "#f3c677", "#452a22", "#fff9f3"], dark: ["#452a22", "#63382c", "#fff9f3", "#522f27"], style: classic },
  "midnight-neon": { name: "Midnight Neon", colors: ["#6c5ce7", "#00e5a8", "#17172a", "#f7f7ff"], dark: ["#17172a", "#252442", "#f7f7ff", "#1e1e35"], style: classic },
  minimalism: { name: "Minimalism", colors: ["#1c1c1c", "#d9d9d9", "#1c1c1c", "#fafafa"], dark: ["#1c1c1c", "#2a2a2a", "#fafafa", "#242424"], style: "minimalism" },
  maximalism: { name: "Maximalism", colors: ["#ff2d55", "#ffd60a", "#1d1b38", "#fff0f7"], dark: ["#1d1b38", "#34305c", "#fff0f7", "#29264a"], style: "maximalism" },
  glassmorphism: { name: "Glassmorphism", colors: ["#7c3aed", "#93c5fd", "#172554", "#e0f2fe"], dark: ["#172554", "#23366f", "#e0f2fe", "#1d2e61"], style: "glassmorphism" },
  neumorphism: { name: "Neumorphism", colors: ["#6b7a99", "#dce4f2", "#44516a", "#e8edf5"], dark: ["#2d374b", "#39455d", "#e8edf5", "#333e54"], style: "neumorphism" },
  brutalism: { name: "Brutalism", colors: ["#ff0000", "#ffff00", "#000000", "#ffffff"], dark: ["#000000", "#1a1a1a", "#ffffff", "#101010"], style: "brutalism" },
  "neo-brutalism": { name: "Neo-brutalism", colors: ["#ff6b00", "#c4ff00", "#101010", "#fff7e8"], dark: ["#101010", "#262626", "#fff7e8", "#1c1c1c"], style: "neo-brutalism" },
  "flat-design": { name: "Flat Design", colors: ["#2563eb", "#fbbf24", "#1f2937", "#f3f4f6"], dark: ["#1f2937", "#334155", "#f3f4f6", "#293548"], style: "flat-design" },
  "bento-ui": { name: "Bento UI", colors: ["#4f46e5", "#a7f3d0", "#111827", "#f8fafc"], dark: ["#111827", "#202b40", "#f8fafc", "#172033"], style: "bento-ui" },
  editorial: { name: "Editorial Design", colors: ["#8b1e3f", "#d9b382", "#251c1b", "#f7f0e8"], dark: ["#251c1b", "#422d2d", "#f7f0e8", "#352626"], style: "editorial" },
  anthropomorphic: { name: "Anthropomorphic", colors: ["#f97316", "#86efac", "#3f2d20", "#fff1dd"], dark: ["#3f2d20", "#5a4030", "#fff1dd", "#4b3528"], style: "anthropomorphic" },
  graffiti: { name: "Graffiti", colors: ["#d500f9", "#00e5ff", "#14121d", "#f8f7ff"], dark: ["#14121d", "#2a2036", "#f8f7ff", "#211a2b"], style: "graffiti" },
  "wabi-sabi": { name: "Wabi-sabi", colors: ["#857e6b", "#c9b99a", "#3e3a32", "#ece7dc"], dark: ["#3e3a32", "#554f44", "#ece7dc", "#49443a"], style: "wabi-sabi" },
  "lubd-street": { name: "Lub d Street", colors: ["#f26135", "#d6de31", "#302f26", "#e5e4da"], dark: ["#302f26", "#3e3d32", "#e5e4da", "#37362e"], style: "lubd-street" },
  "airbnb-style": { name: "Airbnb Style", colors: ["#ff385c", "#484848", "#222222", "#f7f7f7"], dark: ["#222222", "#333333", "#ffffff", "#2b2b2b"], style: classic },
  "aurora-club": { name: "Aurora Club", colors: ["#6246ea", "#2ee6a6", "#17213c", "#f2f4ff"], dark: ["#10152b", "#20274b", "#f4f6ff", "#191f3d"], style: "aurora-club" },
  "desert-club": { name: "Desert Club", colors: ["#c95f32", "#f4c95d", "#3b2a24", "#fff8ed"], dark: ["#30231f", "#4a332a", "#fff4df", "#3d2b25"], style: "desert-club" },
  "dopamine-pop": { name: "Dopamine Pop", colors: ["#ff3d81", "#caff3d", "#24103f", "#fff5fb"], dark: ["#24103f", "#3b1b5d", "#fff7fd", "#32164f"], style: "dopamine-pop" },
  "alpine-luxe": { name: "Alpine Luxe", colors: ["#174c3c", "#d8b879", "#192b26", "#f5f2e9"], dark: ["#14241f", "#203a31", "#f5f2e9", "#1a3029"], style: "alpine-luxe" },
  "y2k-chrome": { name: "Y2K Chrome", colors: ["#3157d5", "#7df9ff", "#20283a", "#edf1f7"], dark: ["#151b29", "#252e42", "#edf7ff", "#1d2536"], style: "y2k-chrome" },
  "retro-postcard": { name: "Retro Postcard", colors: ["#cc493d", "#f1c453", "#22334a", "#f7efe2"], dark: ["#222c39", "#344154", "#fff4df", "#2b3747"], style: "retro-postcard" },
};

export const hostFonts: Record<string, { name: string; family: string }> = {
  default: { name: "Default", family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  "quirky-quest": { name: "Quirky Quest", family: '"Quirky Quest", "Trebuchet MS", cursive' },
  sawit: { name: "Sawit", family: "Sawit, Georgia, serif" },
  cayliath: { name: "Cayliath", family: "Cayliath, Georgia, serif" },
  wacky: { name: "Wacky", family: 'Wacky, "Comic Sans MS", cursive' },
  bellyvia: { name: "Bellyvia", family: "Bellyvia, Georgia, serif" },
  gemi: { name: "Gemi", family: 'Gemi, "Trebuchet MS", sans-serif' },
  montage: { name: "Montage", family: "Montage, Arial, sans-serif" },
  "benso-yolmi": { name: "Benso Yolmi", family: '"Benso Yolmi", Georgia, serif' },
  kica: { name: "Kica", family: 'Kica, "Trebuchet MS", sans-serif' },
  apresto: { name: "Apresto", family: "Apresto, Georgia, serif" },
  beli: { name: "Beli", family: "Beli, Arial, sans-serif" },
  "lubd-pad-type": { name: "Pad Type (Lub d)", family: '"Pad Type", Agrandir, "Arial Black", sans-serif' },
  "airbnb-cereal": { name: "Airbnb Cereal Style", family: '"Airbnb Cereal", Circular, "Helvetica Neue", Arial, sans-serif' },
};

export function hostThemeStyle(theme: string, palette: Record<string, string>, font: string): React.CSSProperties {
  const preset = hostThemes[theme] || hostThemes.default;
  const colors = theme === "custom" ? [palette.primary || "#3157d5", palette.accent || "#d0e562", palette.ink || "#151925", palette.background || "#f8f9fc"] : preset.colors;
  const dark = theme === "custom" ? [colors[2], colors[2], colors[3], colors[2]] : preset.dark;
  return { "--th-blue": colors[0], "--th-lime": colors[1], "--th-ink": colors[2], "--th-page": colors[3], "--th-dark-page": dark[0], "--th-dark-surface": dark[1], "--th-dark-text": dark[2], "--th-dark-field": dark[3], "--th-font": (hostFonts[font] || hostFonts.default).family } as React.CSSProperties;
}
