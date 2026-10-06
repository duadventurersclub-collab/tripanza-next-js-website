import type OpenAI from "openai";
import { isHumanRequest, type TourRoute } from "./consultantFlow.js";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function matchesEscalationKeyword(message: string, keyword: string): boolean {
  const phrase = keyword.trim();
  return !!phrase && new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(phrase)}(?=$|[^\\p{L}\\p{N}])`, "iu").test(message);
}
export function explicitlyRequestsTeam(message: string): boolean {
  return isHumanRequest(message) || matchesEscalationKeyword(message, "#chatcs") || /\b(?:please\s+)?(?:escalate|handoff)\b|\btransfer\s+(?:me|this\s+chat)\b/i.test(message);
}
type History = OpenAI.Chat.Completions.ChatCompletionMessageParam[];
export function teamAssistanceRelevant(message: string, routes: TourRoute[] = [], history: History = []): boolean {
  if (explicitlyRequestsTeam(message)) return true;
  // An unrelated turn does not inherit a previous trip's eligibility for handoff.
  // Short consent is accepted only after the assistant offered a team handoff.
  if (/^(?:yes|yeah|yep|ok(?:ay)?|sure|please|go ahead|do it|haan|han|ha|ji|bilkul|हाँ|हां)[\s!.]*$/iu.test(message.trim())) {
    const previous = [...history].reverse().find(turn => turn.role === "assistant")?.content;
    return typeof previous === "string" && /(?:connect|transfer|handoff|team.*(?:check|help)|agent.*(?:help|reply)|टीम|team se)/i.test(previous);
  }
  if (/\b(?:trip|tour|itinerary|departure|accommodation|hotel|stay|room|pickup|booking|book|payment|refund|cancel(?:lation)?|complaint|complain|charged|invoice|receipt|private|customi[sz]ed|package|travel|price|cost|rate|discount|availability|seat|pdf|brochure)\b|\b(?:safar|yatra|ghoomna|ghumne|kiraya|booking|bhugtan)\b|यात्रा|ट्रिप|बुकिंग|भुगतान|रिफंड|शिकायत|होटल/iu.test(message)) return true;
  return routes.some(route => [route.title, route.slug.replaceAll("-", " "), route.destination || ""].some(name => name.length >= 3 && matchesEscalationKeyword(message, name)));
}
export function casualRedirect(message: string, history: History = []): string {
  const hindi = /[\u0900-\u097f]/u.test(message);
  const hinglish = /\b(?:teri|tera|piya|janam|chahiye|kya|hai|hain|yaar|acha|hum|ham|mera|meri|bata|karna|nahi|haan|baat|ho|main)\b/i.test(message);
  if (/^(?:thanks?|thank you|thankyou|shukriya|dhanyavaad|धन्यवाद)[\s!.😊🙂]*$/iu.test(message.trim())) return hindi ? "खुशी हुई मदद करके 🙂" : hinglish ? "Khushi hui help karke 🙂" : "Happy to help 🙂";
  const continuing = history.some(turn => turn.role === "user" && typeof turn.content === "string" && teamAssistanceRelevant(turn.content));
  if (continuing) return hindi ? "जब भी अपनी ट्रिप के बारे में मदद चाहिए, बताइए 🙂" : hinglish ? "Trip ke baare mein jab bhi help chahiye, bata dena 🙂" : "Whenever you need help with your Tripanza plans, just let me know 🙂";
  return hindi ? "🙂 ट्रिप प्लान करने में मदद चाहिए? कहाँ जाने का सोच रहे हैं?" : hinglish ? "🙂 Trip planning mein help chahiye? Batao, kahan jaana hai?" : "🙂 I can help with your Tripanza travel plans. Where would you like to go?";
}
export const teamHandoffMessage = "Your chat is in the Tripanza team's queue. An agent can reply here after picking it up.";
export function claimsTeamTransfer(text: string): boolean {
  return /(?:i(?:'ll| will| am|'m)?|we(?:'ll| will| are)?|let me)\s+(?:connect|transfer|escalat|hand\s*(?:you|this|it)?\s*off)|(?:connect|transfer|handoff|escalat)[^.!?\n]{0,60}(?:team|agent|human|support)|(?:team|agent)[^.!?\n]{0,30}(?:reply|respond)[^.!?\n]{0,20}(?:shortly|soon)|team\s+se\s+(?:connect|baat\s+karwa)|टीम\s+से\s+(?:जोड़|बात\s+करवा)/iu.test(text);
}
export const handoffInstructions = "HANDOFF POLICY: Greetings, thanks, jokes, lyrics, emojis, casual chatter, unrelated questions and unclear messages are NOT reasons to hand off. Acknowledge briefly and gently return to Tripanza travel help; ask one clarification if needed. Never fabricate non-website facts. Use a handoff only for an explicit human request or a real Tripanza enquiry that needs the team's action or verification. A simple price, itinerary or accommodation question should be answered from available evidence, not handed off. Negotiation and safety concerns are not automatic handoffs. Do not promise that an agent will reply shortly or is available; placing a chat in a queue does not confirm an agent's response time.";
