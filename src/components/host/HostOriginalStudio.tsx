"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioDocument } from "@/lib/host-studio";
import "./original-studio.css";

export default function HostOriginalStudio({ document, title }: { document: StudioDocument; title: string }) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [updatedHTML, setUpdatedHTML] = useState<{ original: string; html: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const html = updatedHTML?.original === document.html ? updatedHTML.html : document.html;

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin || event.data?.source !== "tripanza-original-studio") return;
      const message = event.data;
      if (message.type === "navigate" && typeof message.path === "string" && /^\/(?!\/)/.test(message.path)) {
        setBusy(true);
        if (message.replace) router.replace(message.path);
        else router.push(message.path);
      } else if (message.type === "document" && typeof message.html === "string") {
        setUpdatedHTML({ original: document.html, html: message.html });
      } else if (message.type === "busy") {
        setBusy(Boolean(message.busy));
      } else if (message.type === "ready") {
        setBusy(false);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [document.html, router]);

  if (document.error || !html) return <main className="host-studio-error"><h1>{title}</h1><p role="alert">{document.error || "The Host Studio could not load."}</p><button type="button" onClick={() => router.refresh()}>Try again</button></main>;
  return <main className="host-original-studio" aria-label={title}>
    {busy && <div className="host-studio-progress" role="status" aria-label="Saving or loading the studio" />}
    <iframe ref={frame} title={title} srcDoc={html} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads" allow="clipboard-write; web-share" />
  </main>;
}
