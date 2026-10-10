// Presentation only. Bot state, routes, and connection behavior live in bot.js.
const icons = {
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h8M8 14h5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    qr: '<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM21 15v6h-6M12 3v3M12 12h4M3 12h3M12 16v5"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>'
};

function icon(name, className = '') {
    return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

const styles = `
    :root { color-scheme: light; --ink: #151925; --muted: #687284; --blue: #3157d5; --line: #e1e6ef; --paper: #f6f8fc; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 14px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    .icon { width: 21px; height: 21px; flex: none; }
    .topbar { background: #fff; border-bottom: 1px solid var(--line); }
    .topbar-inner { max-width: 1200px; padding: 20px 40px; margin: auto; display: flex; justify-content: space-between; align-items: center; gap: 18px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark { width: 40px; height: 40px; background: #d0e562; color: #263407; border-radius: 12px; display: grid; place-items: center; }
    .brand-name { display: block; font-size: 20px; font-weight: 750; letter-spacing: -.7px; line-height: 1.2; }
    .brand-sub { color: var(--muted); font-size: 11px; letter-spacing: .5px; }
    .workspace { display: flex; align-items: center; gap: 9px; color: #687284; font-size: 12px; }
    .workspace .icon { width: 16px; height: 16px; }
    .workspace-label { padding-right: 16px; border-right: 1px solid var(--line); }
    .avatar { width: 32px; height: 32px; display: grid; place-items: center; background: #f3f8db; border: 1px solid var(--line); border-radius: 50%; color: var(--blue); font-size: 11px; font-weight: 700; }
    main { max-width: 1200px; margin: auto; padding: 42px 40px 28px; }
    .eyebrow { margin: 0 0 10px; color: var(--blue); font-size: 11px; font-weight: 700; letter-spacing: 1.7px; text-transform: uppercase; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: clamp(28px, 3vw, 38px); letter-spacing: -1.4px; line-height: 1.2; margin-bottom: 12px; font-weight: 650; }
    .lead { color: var(--muted); font-size: 15px; margin: 0; max-width: 530px; }
    .hero { padding: 30px 34px; border: 1px solid #e1e6ef; border-radius: 20px; background: linear-gradient(115deg, #edf1ff, #f3f8db); display: flex; align-items: center; justify-content: space-between; gap: 30px; position: relative; overflow: hidden; }
    .hero-art { width: 144px; height: 144px; display: grid; place-items: center; position: relative; flex: none; }
    .hero-art::before, .hero-art::after { content: ''; position: absolute; border: 1px solid #e1e6ef; border-radius: 50%; width: 140px; height: 140px; }
    .hero-art::after { width: 105px; height: 105px; }
    .hero-art > .icon { height: 66px; width: 66px; color: var(--blue); padding: 14px; box-sizing: content-box; background: #e1e6ef; border-radius: 27px; transform: rotate(-8deg); z-index: 1; }
    .hero-art .art-dot { position: absolute; z-index: 2; right: 6px; bottom: 20px; width: 30px; height: 30px; border: 4px solid #f2f6ee; border-radius: 50%; background: #377d56; display: grid; place-items: center; color: white; }
    .art-dot .icon { width: 14px; height: 14px; }
    .section-heading { margin: 30px 0 17px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .section-heading h2 { font-size: 18px; letter-spacing: -.4px; margin: 0; font-weight: 650; }
    .section-heading span { font-size: 12px; color: var(--muted); }
    .bot-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
    .bot-card { border: 1px solid var(--line); border-radius: 17px; background: #fff; box-shadow: 0 4px 16px #243d2904; overflow: hidden; }
    .card-body { padding: 26px; }
    .card-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 25px; }
    .bot-icon { width: 48px; height: 48px; display: grid; place-items: center; border: 1px solid #dfe8f8; border-radius: 13px; background: #edf3fe; color: #5279be; }
    .bot-icon.crm { border-color: #e1e6ef; background: #f3f8db; color: #203da6; }
    .bot-icon .icon { width: 24px; height: 24px; }
    .status { display: inline-flex; align-items: center; gap: 7px; border-radius: 30px; padding: 5px 10px; font-size: 11px; font-weight: 600; white-space: nowrap; line-height: 1.5; }
    .status::before { content: ''; height: 6px; width: 6px; border-radius: 50%; background: currentColor; flex: none; }
    .offline { background: #fff6e7; color: #92601c; border: 1px solid #f1e4cd; }
    .online { background: #eef7ef; color: #256446; border: 1px solid #d9ebde; }
    .bot-number { color: var(--muted); font-size: 10px; font-weight: 600; letter-spacing: 1.3px; text-transform: uppercase; margin-bottom: 5px; }
    .bot-card h3 { margin-bottom: 9px; font-size: 23px; letter-spacing: -.7px; line-height: 1.3; font-weight: 650; }
    .description { color: var(--muted); margin-bottom: 22px; font-size: 13px; min-height: 42px; max-width: 360px; }
    .tags { display: flex; flex-wrap: wrap; gap: 7px; }
    .tag { border: 1px solid #e8ece8; border-radius: 6px; padding: 3px 8px; color: #687284; font-size: 10px; background: #f6f8fc; }
    .card-footer { background: #f6f8fc; border-top: 1px solid #eaf0e9; padding: 17px 26px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .connection-label { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
    .connection-label .icon { width: 15px; height: 15px; }
    .button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: var(--blue); color: #fff; border: 1px solid var(--blue); border-radius: 8px; padding: 10px 13px; font-size: 12px; font-weight: 600; line-height: 1.5; transition: background .15s, box-shadow .15s, transform .15s; }
    .button .icon { width: 15px; height: 15px; }
    .button:hover { background: #203da6; box-shadow: 0 3px 9px #3157d520; transform: translateY(-1px); }
    a:focus-visible { outline: 3px solid #609ad0; outline-offset: 4px; }
    .setup-guide { margin-top: 26px; padding: 23px 26px; background: #fff; border: 1px solid var(--line); border-radius: 14px; display: grid; grid-template-columns: 1.05fr 2fr; gap: 28px; align-items: center; }
    .guide-title { display: flex; gap: 13px; align-items: flex-start; }
    .guide-title > .icon { margin-top: 4px; color: var(--blue); }
    .guide-title h2 { font-size: 14px; margin-bottom: 3px; font-weight: 650; }
    .guide-title p { font-size: 11px; color: var(--muted); margin-bottom: 0; }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; padding: 0; margin: 0; list-style: none; }
    .steps li { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; font-weight: 600; line-height: 1.5; }
    .step-number { flex: none; display: grid; place-items: center; width: 23px; height: 23px; background: #f3f8db; border: 1px solid #e5ece1; border-radius: 50%; color: #203da6; font-size: 10px; }
    .steps small { display: block; font-size: 10px; font-weight: 400; color: var(--muted); margin-top: 3px; }
    footer { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-top: 30px; color: #687284; font-size: 10px; }
    .footer-engine { display: flex; align-items: center; gap: 6px; }
    .footer-engine .icon { height: 13px; width: 13px; }
    .back-link { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: 12px; margin-bottom: 25px; }
    .back-link:hover { color: var(--blue); }
    .back-link .icon { width: 16px; height: 16px; }
    .setup-heading { text-align: center; margin-bottom: 28px; }
    .setup-heading .lead { margin: auto; }
    .setup-heading .bot-icon { margin: 0 auto 18px; }
    .pairing-card { max-width: 810px; margin: auto; background: white; border: 1px solid var(--line); border-radius: 20px; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; }
    .pairing-instructions { padding: 34px; }
    .pairing-instructions h2 { font-size: 18px; letter-spacing: -.4px; margin-bottom: 9px; }
    .pairing-instructions > p { font-size: 12px; color: var(--muted); margin-bottom: 26px; }
    .pairing-instructions .steps { grid-template-columns: 1fr; gap: 22px; }
    .pairing-instructions .steps li { font-size: 13px; gap: 12px; }
    .pairing-instructions .steps small { font-size: 11px; }
    .pairing-instructions .step-number { height: 28px; width: 28px; font-size: 11px; }
    .pairing-visual { border-left: 1px solid var(--line); padding: 28px; text-align: center; background: #f3f6fb; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 390px; }
    .qr-frame { background: #fff; border: 1px solid var(--line); border-radius: 13px; padding: 12px; width: 100%; max-width: 262px; }
    .qr-frame img { display: block; width: 100%; height: auto; }
    .pairing-visual .status { margin-top: 18px; }
    .refresh-note { color: var(--muted); font-size: 11px; margin: 12px 0 0; }
    .state-icon { display: grid; place-items: center; width: 86px; height: 86px; background: #f3f8db; color: var(--blue); border: 1px solid #dce7d8; border-radius: 24px; margin-bottom: 24px; }
    .state-icon .icon { width: 38px; height: 38px; }
    .pairing-visual h2 { font-size: 20px; letter-spacing: -.5px; margin-bottom: 8px; }
    .pairing-visual > p { max-width: 255px; }
    .pairing-visual .button { margin-top: 20px; }
    .spinner { height: 34px; width: 34px; border: 3px solid #d6e5d0; border-top-color: var(--blue); border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
    @media (max-width: 850px) { .setup-guide { grid-template-columns: 1fr; gap: 20px; } .hero-art { width: 110px; height: 110px; } .hero-art::before { width: 110px; height: 110px; } .hero-art::after { width: 85px; height: 85px; } .hero-art > .icon { width: 42px; height: 42px; } .card-footer { align-items: flex-start; flex-direction: column; } .card-footer .button { width: 100%; } }
    @media (max-width: 600px) { .topbar-inner { padding: 17px 20px; } .workspace-label { display: none; } main { padding: 27px 20px 24px; } .hero { padding: 26px 23px; } .hero-art { display: none; } h1 { letter-spacing: -.9px; } .lead { font-size: 13px; } .bot-grid { grid-template-columns: 1fr; gap: 17px; } .section-heading { margin-top: 25px; } .card-body { padding: 23px; } .description { min-height: auto; } .card-footer { flex-direction: row; align-items: center; padding: 17px 23px; } .card-footer .button { width: auto; } .setup-guide { padding: 22px; } .steps { grid-template-columns: 1fr; gap: 16px; } .steps small { font-size: 11px; } footer { flex-direction: column; align-items: flex-start; gap: 5px; margin-top: 24px; } .pairing-card { grid-template-columns: 1fr; } .pairing-instructions { padding: 26px; } .pairing-visual { border-left: 0; border-top: 1px solid var(--line); min-height: 340px; } .setup-heading h1 { font-size: 28px; } }
    @media (max-width: 600px) { .section-heading { align-items: flex-start; flex-direction: column; } }
    @media (max-width: 360px) { main { padding-left: 14px; padding-right: 14px; } .card-top { gap: 7px; } .card-footer { flex-direction: column; align-items: stretch; } }
`;

function page(title, content, refreshMs = 0) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#17634d">
    <title>${title}</title>
    <style>${styles}</style>
</head>
<body>
    <header class="topbar"><div class="topbar-inner">
        <a class="brand" href="/" aria-label="Tripanza dashboard"><span class="brand-mark">${icon('chat')}</span><span><span class="brand-name">tripanza<span style="color:#438060">.</span></span><span class="brand-sub">WHATSAPP WORKSPACE</span></span></a>
        <div class="workspace"><span class="workspace-label">${icon('layers')} &nbsp; Bot management</span><span class="avatar" aria-label="Tripanza">T</span></div>
    </div></header>
    <main>${content}<footer><span>Tripanza AI CRM &middot; WhatsApp workspace</span><span class="footer-engine">${icon('layers')} Dual Baileys Engine</span></footer></main>
    ${refreshMs ? `<script>setTimeout(() => location.reload(), ${refreshMs});</script>` : ''}
</body>
</html>`;
}

function steps() {
    return `<ol class="steps">
        <li><span class="step-number">1</span><span>Open WhatsApp<small>Use the phone for this bot.</small></span></li>
        <li><span class="step-number">2</span><span>Linked devices<small>Tap &ldquo;Link a device&rdquo;.</small></span></li>
        <li><span class="step-number">3</span><span>Scan the QR code<small>Your bot connects automatically.</small></span></li>
    </ol>`;
}

function botCard({ crm, connected }) {
    return `<article class="bot-card">
        <div class="card-body">
            <div class="card-top"><span class="bot-icon ${crm ? 'crm' : ''}">${icon(crm ? 'spark' : 'bell')}</span><span class="status ${connected ? 'online' : 'offline'}">${connected ? 'Online' : 'Offline / awaiting QR'}</span></div>
            <p class="bot-number">Bot ${crm ? '02' : '01'} &middot; ${crm ? 'Customer conversations' : 'Transactional messaging'}</p>
            <h3>${crm ? 'Kanika AI CRM' : 'Notifications &amp; OTPs'}</h3>
            <p class="description">${crm ? 'Customer conversations, booking updates and itineraries, with human chat and optional scheduled AI replies.' : 'Your separate number for one-time passwords. Pair the customer-support number with CRM.'}</p>
            <div class="tags">${crm ? '<span class="tag">AI assistant</span><span class="tag">Customer replies</span><span class="tag">Follow-ups</span>' : '<span class="tag">Notifications</span><span class="tag">OTP delivery</span><span class="tag">Dedicated number</span>'}</div>
        </div>
        <div class="card-footer"><span class="connection-label">${icon('phone')}${connected ? 'WhatsApp connected' : 'Connect your WhatsApp'}</span><a class="button" href="${crm ? '/qr-crm' : '/qr-notifications'}" aria-label="View QR code for ${crm ? 'Kanika AI CRM' : 'Notifications and OTPs'}">${icon('qr')} View QR code ${icon('arrow')}</a></div>
    </article>`;
}

function renderDashboard(notificationsConnected, crmConnected) {
    return page('Tripanza Bots Dashboard', `
        <section class="hero" aria-labelledby="dashboard-title">
            <div><p class="eyebrow">Your communication hub</p><h1 id="dashboard-title">A little connection.<br>A lot of conversation.</h1><p class="lead">Manage your WhatsApp bots in one place. Connect your numbers and let Tripanza take it from here.</p></div>
            <div class="hero-art" aria-hidden="true">${icon('chat')}<span class="art-dot">${icon('check')}</span></div>
        </section>
        <div class="section-heading"><h2>Your WhatsApp bots</h2><a class="button" href="/workspace">${icon('chat')} Open team workspace ${icon('arrow')}</a></div>
        <section class="bot-grid" aria-label="WhatsApp bot connections">${botCard({ crm: false, connected: notificationsConnected })}${botCard({ crm: true, connected: crmConnected })}</section>
        <section class="setup-guide" aria-label="Connection instructions"><div class="guide-title">${icon('info')}<div><h2>First time connecting?</h2><p>Link each bot with its own WhatsApp number.</p></div></div>${steps()}</section>
    `);
}

function renderBotPage(crm, state, qrImageDataURL = '') {
    const name = crm ? 'Kanika AI CRM' : 'Notifications & OTPs';
    let visual;
    if (state === 'connected') {
        visual = `<span class="state-icon">${icon('check')}</span><h2>You&rsquo;re connected.</h2><p class="refresh-note">${crm ? 'CRM Bot' : 'Notifications Bot'} is connected to WhatsApp.</p><span class="status online">Online</span><a class="button" href="/">Back to dashboard ${icon('arrow')}</a>`;
    } else if (state === 'qr') {
        visual = `<div class="qr-frame"><img src="${qrImageDataURL}" alt="Scan this QR code in WhatsApp to connect the ${crm ? 'CRM' : 'Notifications'} bot" width="300" height="300"></div><span class="status offline">Ready to scan</span><p class="refresh-note">QR code refreshes automatically every 30 seconds.</p>`;
    } else {
        visual = `<span class="state-icon"><span class="spinner" aria-hidden="true"></span></span><h2>Getting things ready.</h2><p class="refresh-note">Starting ${crm ? 'CRM' : 'Notifications'} Bot. Your QR code will appear here shortly.</p><p class="refresh-note">This page refreshes every 5 seconds.</p>`;
    }
    return page(`${name} · Tripanza`, `
        <a class="back-link" href="/">${icon('back')} Back to dashboard</a>
        <section class="setup-heading"><div class="bot-icon ${crm ? 'crm' : ''}">${icon(crm ? 'spark' : 'bell')}</div><p class="eyebrow">${state === 'connected' ? 'Connection complete' : 'WhatsApp setup'}</p><h1>${name}</h1><p class="lead">${state === 'connected' ? 'Your WhatsApp connection is ready.' : 'One quick scan to get your bot connected.'}</p></section>
        ${crm ? '<p><a class="button" href="/admin/bot">Manage AI replies and schedule</a></p>' : ''}
        <section class="pairing-card" aria-label="WhatsApp connection"><div class="pairing-instructions"><h2>Connect in three simple steps</h2><p>Keep your phone handy and open WhatsApp on the number you want to use.</p>${steps()}</div><div class="pairing-visual" role="status">${visual}</div></section>
    `, state === 'qr' ? 30000 : state === 'starting' ? 5000 : 0);
}

module.exports = { renderDashboard, renderBotPage };
