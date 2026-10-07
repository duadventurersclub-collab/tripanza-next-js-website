"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "./login-onboarding.css";

const stories = [
  { title: "Pick a date. Meet your crew.", badges: [["🗓️", "Fresh dates"], ["⚡", "Leaving soon"], ["👥", "Crew loading"], ["🏔️", "Friday escape"]] },
  { title: "Real people. Real plans.", badges: [["🤝", "Your kind of crew"], ["✨", "Real moments"], ["🎒", "Go together"], ["📍", "New places"]] },
  { title: "Safe stays. Solid crew.", badges: [["🔒", "Secure payment"], ["🏡", "Good stays"], ["✓", "Trip confirmed"], ["💬", "Here to help"]] },
  { title: "Your next story starts here.", badges: [["📸", "Crew memories"], ["🌄", "Big views"], ["💙", "New friends"], ["✈️", "Let's go"]] },
] as const;

type Props = { onLogin: () => void; onClose: () => void };

export default function LoginOnboarding({ onLogin, onClose }: Props) {
  const [story, setStory] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setStory((current) => (current + 1) % stories.length), 3500);
    return () => window.clearTimeout(timer);
  }, [story]);

  const selectStory = (index: number) => setStory((index + stories.length) % stories.length);

  return (
    <section className="tp-login-intro" aria-label="Welcome to Tripanza">
      <header className="tp-login-intro__top">
        <button type="button" className="tp-login-intro__close" onClick={onClose} aria-label="Close login">×</button>
        <Link className="tp-login-intro__mark" href="/" onClick={onClose} aria-label="Tripanza home">
          <Image src="https://tripanza.com/wp-content/uploads/2026/04/Tripanza-Logo-3.png" alt="" width={32} height={32} unoptimized />
        </Link>
        <button type="button" className="tp-login-intro__skip" onClick={onClose}>Skip</button>
      </header>

      <h1 className="tp-login-intro__headline" key={story}>{stories[story].title}</h1>

      <div className="tp-login-intro__visual" onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={(event) => {
        if (!touchStart.current) return;
        const x = event.changedTouches[0].clientX - touchStart.current.x;
        const y = event.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        const distance = Math.abs(x) > Math.abs(y) ? x : y;
        if (Math.abs(distance) > 38) selectStory(story + (distance < 0 ? 1 : -1));
      }}>
        <div className="tp-login-intro__orbit" aria-hidden="true" />
        {stories[story].badges.map(([icon, label], index) => <div className={`tp-login-intro__badge tp-login-intro__badge--${index}`} key={`${story}-${label}`} aria-hidden="true"><span>{icon}</span><b>{label}</b></div>)}
        <div className="tp-login-intro__phone" aria-label={`Story ${story + 1}: ${stories[story].title}`}>
          <div className="tp-login-intro__notch" aria-hidden="true" />
          <div className="tp-login-intro__status" aria-hidden="true"><b>9:41</b><span>● ᴡɪꜰɪ ▰</span></div>
          <div className={`tp-login-intro__phone-content${story === 1 || story === 3 ? " is-image" : ""}`} key={story}>
            {story === 0 ? <div className="tp-login-intro__date-screen">
              <span className="tp-login-intro__kicker">⚡ LEAVING SOON</span>
              <h2>Pick a date.<strong>Meet your crew.</strong></h2>
              <div className="tp-login-intro__filters"><span>All dates</span><span>Sep 2026</span><span>Oct 2026</span></div>
              <div className="tp-login-intro__trip-stage"><i /><div className="tp-login-intro__trip-card"><span>Most Selling</span><div><b>Jibhi Tirthan Trip</b><small>Fri, 25 Sep · From Delhi</small><strong>₹7,499</strong></div></div><i /></div>
              <div className="tp-login-intro__thumbs"><i /><i /><i /><i /><i /></div>
            </div> : story === 1 ? <div className="tp-login-intro__image-screen tp-login-intro__image-screen--spiti"><span>EXPLORE TOGETHER</span><strong>Real people.<br />Real plans.</strong></div> : story === 2 ? <div className="tp-login-intro__payment-screen"><span>✓</span><strong>Payment successful</strong><b>₹10,000</b><small>Booking ID: TRP-2345Z</small><p>Booked. Bags next.</p></div> : <div className="tp-login-intro__image-screen tp-login-intro__image-screen--crew"><span>CREW CAM · LIVE</span><strong>Came for the trip.<br />Stayed for the people.</strong></div>}
          </div>
        </div>
      </div>

      <footer className="tp-login-intro__bottom">
        <div className="tp-login-intro__progress" aria-label="Onboarding stories">{stories.map((item, index) => <button type="button" key={item.title} className={index === story ? "is-active" : ""} onClick={() => selectStory(index)} aria-label={`Show story ${index + 1}`} aria-current={index === story ? "step" : undefined}><span key={index === story ? `${index}-active` : index} /></button>)}</div>
        <button type="button" className="tp-login-intro__login" onClick={onLogin}>Login</button>
        <p>By clicking continue, you are agreeing to Tripanza<br /><Link href="/tnc" target="_blank">terms &amp; conditions</Link> and <Link href="/privacy-policy" target="_blank">Privacy policy</Link></p>
      </footer>
    </section>
  );
}
