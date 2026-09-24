"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { TourDetail } from "@/lib/wp";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

type BookingRow = {
  qty?: number;
  label?: string;
  unit?: string;
  total?: string;
};

type BookingSummary = {
  tour?: string;
  departure?: string;
  travellers?: number;
  rows?: BookingRow[];
  estimated_total?: string;
  confirm_text?: string;
  state_token?: string;
};

type ChatResponse = {
  reply?: string;
  error?: string;
  chat_token?: string;
  suggestions?: string[];
  history?: ChatMessage[];
  booking_summary?: BookingSummary | null;
  clear_booking_state?: boolean;
};

interface TourAiChatProps {
  tour: TourDetail;
  whatsappUrl: string;
}

const DEFAULT_SUGGESTIONS = [
  "Check available dates",
  "What is included?",
  "Is it solo-friendly?",
  "Pickup point?",
  "I want to book",
];

function createChatToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getChatToken() {
  const stored = window.localStorage.getItem("tripanza_chat_token") || "";
  const token = /^[a-f0-9]{32}$/i.test(stored) ? stored : createChatToken();
  window.localStorage.setItem("tripanza_chat_token", token);
  return token;
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TourAiChat({ tour, whatsappUrl }: TourAiChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [bookingSummary, setBookingSummary] = useState<BookingSummary | null>(null);
  const [bookingState, setBookingState] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const welcome = useMemo(
    () => `Hey! Main Kanika hoon, your Tripanza tour copilot for ${tour.title}. Ask me about dates, pickup, stays, pricing or booking.`,
    [tour.title],
  );

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, bookingSummary]);

  useEffect(() => {
    if (!open || historyLoaded || !loadingHistory) return;
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/tour-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync", chatToken: getChatToken(), tourId: tour.id }),
        });
        const data = (await response.json().catch(() => ({}))) as ChatResponse;
        if (!response.ok) throw new Error(data.error || "Could not load the chat.");
        if (!active) return;
        if (data.chat_token && /^[a-f0-9]{32}$/i.test(data.chat_token)) {
          window.localStorage.setItem("tripanza_chat_token", data.chat_token);
        }
        const history = Array.isArray(data.history)
          ? data.history.filter(
              (message) =>
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string" &&
                !message.content.startsWith("BEHAVIORAL FOOTPRINT:"),
            )
          : [];
        setMessages(history.length ? history : [{ role: "assistant", content: welcome, timestamp: timeNow() }]);
      } catch {
        if (active) setMessages([{ role: "assistant", content: welcome, timestamp: timeNow() }]);
      } finally {
        if (active) {
          setHistoryLoaded(true);
          setLoadingHistory(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [historyLoaded, loadingHistory, open, tour.id, welcome]);

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || sending) return;

    const userMessage: ChatMessage = { role: "user", content: question, timestamp: timeNow() };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setError("");
    setBookingSummary(null);
    setSending(true);

    try {
      const response = await fetch("/api/tour-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ask",
          chatToken: getChatToken(),
          tourId: tour.id,
          tourUrl: tour.link || `https://tripanza.com/tour/${tour.slug}/`,
          question,
          history: historyLoaded ? [] : nextHistory.slice(-12),
          clientBootstrap: !historyLoaded,
          bookingState,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as ChatResponse;
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");

      if (data.chat_token && /^[a-f0-9]{32}$/i.test(data.chat_token)) {
        window.localStorage.setItem("tripanza_chat_token", data.chat_token);
      }
      if (data.clear_booking_state) setBookingState("");
      if (data.booking_summary?.state_token) setBookingState(data.booking_summary.state_token);
      setBookingSummary(data.booking_summary || null);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply || "I could not find that answer. Please try another question.",
          timestamp: timeNow(),
        },
      ]);
      setSuggestions(
        Array.isArray(data.suggestions) && data.suggestions.length
          ? data.suggestions.slice(0, 6)
          : DEFAULT_SUGGESTIONS,
      );
      setHistoryLoaded(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Kanika is temporarily unavailable.");
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function openChat() {
    if (!historyLoaded) setLoadingHistory(true);
    setOpen(true);
  }

  async function clearChat() {
    if (sending) return;
    try {
      const response = await fetch("/api/tour-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", chatToken: getChatToken(), tourId: tour.id }),
      });
      const data = (await response.json().catch(() => ({}))) as ChatResponse;
      if (data.chat_token && /^[a-f0-9]{32}$/i.test(data.chat_token)) {
        window.localStorage.setItem("tripanza_chat_token", data.chat_token);
      }
    } catch {
      // A local reset still gives the visitor a clean, usable conversation.
    }
    setMessages([{ role: "assistant", content: welcome, timestamp: timeNow() }]);
    setBookingSummary(null);
    setBookingState("");
    setSuggestions(DEFAULT_SUGGESTIONS);
    setError("");
  }

  return (
    <>
      <button type="button" className="tp-tour-assistant" onClick={openChat} aria-haspopup="dialog">
        <span className="tp-tour-assistant__mark">
          <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
        </span>
        <span className="tp-tour-assistant__copy">
          <strong>Ask Kanika about this trip</strong>
          <small>Dates, stays, pricing, pickup &amp; booking</small>
        </span>
        <span className="tp-tour-assistant__send" aria-hidden="true">
          <i className="fa-solid fa-arrow-up" />
        </span>
      </button>

      {open && (
        <div className="tp-ai-chat" role="dialog" aria-modal="true" aria-label={`Ask Kanika about ${tour.title}`}>
          <button className="tp-ai-chat__backdrop" type="button" onClick={() => setOpen(false)} aria-label="Close chat" />
          <section className="tp-ai-chat__panel">
            <header className="tp-ai-chat__header">
              <div className="tp-ai-chat__avatar" aria-hidden="true">
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
              <div>
                <strong>Kanika</strong>
                <span><i /> Your live trip assistant</span>
              </div>
              <button type="button" className="tp-ai-chat__clear" onClick={() => void clearChat()} aria-label="Start a new chat" title="Start a new chat">
                <i className="fa-solid fa-trash-can" aria-hidden="true" />
              </button>
              <button type="button" className="tp-ai-chat__close" onClick={() => setOpen(false)} aria-label="Close chat">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </header>

            <div className="tp-ai-chat__tour">
              <i className="fa-solid fa-route" aria-hidden="true" />
              <span><small>Talking about</small><strong>{tour.title}</strong></span>
            </div>

            <div className="tp-ai-chat__messages" ref={messagesRef} aria-live="polite">
              {loadingHistory ? (
                <div className="tp-ai-chat__loading"><span /><span /><span /> Fetching your conversation</div>
              ) : (
                messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`tp-ai-message tp-ai-message--${message.role}`}>
                    <p>{message.content}</p>
                    <time>{message.timestamp || ""}</time>
                  </div>
                ))
              )}

              {sending && (
                <div className="tp-ai-message tp-ai-message--assistant tp-ai-message--typing" aria-label="Kanika is typing">
                  <span /><span /><span />
                </div>
              )}

              {bookingSummary && (
                <section className="tp-ai-booking-summary">
                  <small>Ready to reserve</small>
                  <h4>{bookingSummary.tour || tour.title}</h4>
                  <p>{[bookingSummary.departure, bookingSummary.travellers ? `${bookingSummary.travellers} travellers` : ""].filter(Boolean).join(" · ")}</p>
                  {bookingSummary.rows?.map((row, index) => (
                    <div className="tp-ai-booking-summary__row" key={`${row.label}-${index}`}>
                      <span>{row.qty || 0} × {row.label || "Sharing"}<small>{row.unit || ""}</small></span>
                      <strong>{row.total || ""}</strong>
                    </div>
                  ))}
                  {bookingSummary.estimated_total && (
                    <div className="tp-ai-booking-summary__total"><span>Estimated total</span><strong>{bookingSummary.estimated_total}</strong></div>
                  )}
                  <button type="button" onClick={() => void sendMessage("Confirm booking")} disabled={sending}>
                    {bookingSummary.confirm_text || "Confirm booking"}
                  </button>
                </section>
              )}

              {error && (
                <div className="tp-ai-chat__error">
                  <p>{error}</p>
                  <button type="button" onClick={() => void sendMessage(messages.filter((message) => message.role === "user").at(-1)?.content || "")}>Retry</button>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp us</a>
                </div>
              )}
            </div>

            <div className="tp-ai-chat__suggestions" aria-label="Suggested questions">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} disabled={sending}>
                  {suggestion}
                </button>
              ))}
            </div>

            <form className="tp-ai-chat__composer" onSubmit={submit}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 1000))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Ask about this trip…"
                rows={1}
                aria-label="Message Kanika"
              />
              <button type="submit" disabled={sending || !input.trim()} aria-label="Send message">
                <i className="fa-solid fa-arrow-up" aria-hidden="true" />
              </button>
            </form>
            <small className="tp-ai-chat__note">Kanika can make mistakes. Confirm important trip details before paying.</small>
          </section>
        </div>
      )}
    </>
  );
}
