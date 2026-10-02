"use client";

import type { HostProfile } from "@/lib/host";
import { hostFonts, hostThemes, hostThemeStyle } from "./profile-themes";

type Props = {
  profile: HostProfile;
  name: string; setName: (value: string) => void;
  phone: string; setPhone: (value: string) => void;
  tagline: string; setTagline: (value: string) => void;
  bio: string; setBio: (value: string) => void;
  instagram: string; setInstagram: (value: string) => void;
  theme: string; setTheme: (value: string) => void;
  font: string; setFont: (value: string) => void;
  palette: Record<string, string>; setPalette: (value: Record<string, string>) => void;
  setLogoFile: (value: File | null) => void;
  setCoverFile: (value: File | null) => void;
  error: string; busy: boolean; dark: boolean;
  onClose: () => void; onSave: (event: React.FormEvent) => void;
};

export default function HostProfileEditor(props: Props) {
  const { profile, name, setName, phone, setPhone, tagline, setTagline, bio, setBio, instagram, setInstagram, theme, setTheme, font, setFont, palette, setPalette, setLogoFile, setCoverFile, error, busy, dark, onClose, onSave } = props;
  const colors = theme === "custom" ? [palette.primary || "#3157d5", palette.accent || "#d0e562", palette.ink || "#151925", palette.background || "#f8f9fc"] : (hostThemes[theme] || hostThemes.default).colors;
  return <div className="tp-host-editor is-open" data-host-style={hostThemes[theme]?.style || "classic"} data-host-dark={dark ? "1" : "0"} style={hostThemeStyle(theme, palette, font)} role="dialog" aria-modal="true" aria-labelledby="tpHostEditorTitle">
    <div className="tp-host-editor__panel">
      <button type="button" className="tp-host-sheet__close" onClick={onClose} aria-label="Close">×</button>
      <span className="tp-host-kicker">HOST MODE</span>
      <h3 id="tpHostEditorTitle">Your public host identity.</h3>
      <p className="tp-host-editor__intro">Keep this recognisable. Travellers see these details before they decide to book.</p>
      {error && <div className="tp-host-editor__error" role="alert">{error}</div>}
      <form onSubmit={onSave}>
        <div className="tp-host-editor__media-grid">
          <label className="tp-host-upload-card"><span>Profile logo</span><b className="tp-host-upload-card__preview is-logo">{profile.logo ? <img src={profile.logo} alt="" /> : "+"}</b><small>Use a clear logo or recognisable photo</small><span className="tp-host-upload-card__action">Choose logo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setLogoFile(event.target.files?.[0] || null)} /></label>
          <label className="tp-host-upload-card"><span>Cover image <em>Optional</em></span><b className="tp-host-upload-card__preview is-cover"><img src={profile.cover || "https://tripanza.com/wp-content/uploads/2026/09/0ba194b9-5683-4b3d-a91c-0712c09fcfac.png"} alt="" /></b><small>Your default Tripanza cover stays until you replace it</small><span className="tp-host-upload-card__action">Choose cover</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setCoverFile(event.target.files?.[0] || null)} /></label>
        </div>
        <label>Public host name <small>REQUIRED · VISIBLE TO TRAVELLERS</small><input type="text" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} autoComplete="organization" required placeholder="Your name or community name" /></label>
        <label>Traveller contact number <small>REQUIRED · VISIBLE TO TRAVELLERS</small><input type="tel" value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" maxLength={24} required placeholder="+91 98765 43210" /></label>
        <label>Instagram or website <small>PUBLIC · OPTIONAL</small><input type="url" value={instagram} onChange={event => setInstagram(event.target.value)} placeholder="https://instagram.com/yourhandle" /></label>
        <label>Tagline <small>PUBLIC · OPTIONAL</small><input type="text" value={tagline} onChange={event => setTagline(event.target.value)} maxLength={120} placeholder="One line that sells your vibe" /></label>
        <label>Short bio <small>PUBLIC · OPTIONAL</small><textarea value={bio} onChange={event => setBio(event.target.value)} rows={4} maxLength={500} placeholder="What makes your trips different?" /></label>
        <fieldset className="tp-host-appearance"><legend>Profile design preset <small>PUBLIC · CHANGES THE PAGE STYLE FOR TRAVELLERS</small></legend><div className="tp-host-palette-grid">{[...Object.entries(hostThemes), ["custom", { name: "Your custom palette", colors, dark: colors, style: "classic" }] as const].map(([key, preset]) => <label className="tp-host-palette" key={key}><input type="radio" name="host-profile-theme" value={key} checked={theme === key} onChange={() => setTheme(key)} /><span className="tp-host-palette__card"><i>{preset.colors.map((color, index) => <b key={index} style={{ background: color }} />)}</i><strong>{preset.name}</strong></span></label>)}</div>{theme === "custom" && <div className="tp-host-custom-palette"><span>Build your own palette</span><div>{(["primary", "accent", "ink", "background"] as const).map((key, index) => <label key={key}>{key}<input type="color" value={palette[key] || hostThemes.default.colors[index]} onChange={event => setPalette({ ...palette, [key]: event.target.value })} /></label>)}</div></div>}</fieldset>
        <label className="tp-host-font-choice">Profile font <small>PUBLIC · VISIBLE TO TRAVELLERS</small><select value={font} onChange={event => setFont(event.target.value)}>{Object.entries(hostFonts).map(([key, choice]) => <option key={key} value={key} style={{ fontFamily: choice.family }}>{choice.name}</option>)}</select></label>
        <button type="submit" className="tp-host-editor__save" disabled={busy}>{busy ? "Saving…" : "Save profile"}<span>→</span></button>
      </form>
    </div>
  </div>;
}
