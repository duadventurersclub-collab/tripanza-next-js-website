export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "Now";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Now";

  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Now";
  if (minutes < 60) return minutes + "m";
  if (hours < 24) return hours + "h";
  if (days < 7) return days + "d";

  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.slice(1);
  }
  return "+" + cleaned;
}

let audioCtx: AudioContext | null = null;

export function playBeep(): void {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch {
    // Audio not supported
  }
}
