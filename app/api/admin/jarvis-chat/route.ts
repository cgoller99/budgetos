import { verifyAppleSubscriptionStatus } from "@/lib/iap/appleSubscriptionStatus";
import { NextResponse } from "next/server";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getAdminOverviewMetrics } from "@/lib/admin/metricsService";
import { getAdminRevenueMetrics } from "@/lib/admin/revenueService";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { isAiTeamModelRuntimeAvailable } from "@/lib/ai-team/modelRuntime";
import { BUXME_JARVIS_CONTEXT } from "@/lib/jarvis/businessContext";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const raw = body && typeof body === "object" ? (body as { messages?: unknown }).messages : undefined;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
  const messages = raw.map((m: unknown) => {
    if (!m || typeof m !== "object") return null;
    const item = m as { role?: unknown; content?: unknown };
    if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string" || item.content.length > 3000) return null;
    return { role: item.role, content: item.content };
  });
  if (messages.some(m => !m) || messages[messages.length - 1]?.role !== "user") return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  if (!isAiTeamModelRuntimeAvailable()) return NextResponse.json({ error: "Jarvis conversation AI is not configured yet. Worker activity is available in the Activity tab." }, { status: 503 });
  try {
    const result = await generateText({
      model: process.env.JARVIS_CHAT_MODEL?.trim() || "openai/gpt-4o-mini",
      system: BUXME_JARVIS_CONTEXT + "\n\nYou are Jarvis, the Buxme founder's highly capable chief of staff. Your personality is composed, confident, intelligent, observant and subtly dry-witted. You speak with refined British restraint: concise, precise, genuinely funny with occasional sharp, dry one-liners and understated sarcasm, especially when the founder jokes or something breaks. Keep humour brief and situational, never at the expense of users or serious incidents; never force a joke into every response. Never obsequious or theatrical. Be proactive: suggest the single most valuable next step, and distinguish facts from assumptions. Never pretend you have completed work. When asked to verify Apple subscriber counts or reconcile Apple revenue, call auditAppleSubscriptions and distinguish verified status from estimated list-price MRR. For growth and business-health questions, proactively call getLiveBusinessMetrics, interpret the numbers, name the strongest growth bottleneck and propose a concrete measurable experiment. Do not assume Apple revenue is included in Stripe MRR. Speak naturally in short sentences suitable for spoken playback. You can discuss plans and propose tasks, but this chat can read aggregated live Buxme growth and Stripe revenue metrics through getLiveBusinessMetrics when relevant, but cannot execute code, send messages, spend money, modify subscriptions, or access private customer records. Never claim to have performed an action. Only claim to have checked live data when getLiveBusinessMetrics returned it in this conversation; cite its checkedAt time in plain language. For production, payments, authentication, banking, customer data, and outreach, require explicit approval. Do not reveal secrets. Be transparent about what is not connected. Avoid generic assistant clichés: avoid stock greetings, generic capability lists, and empty follow-up questions. Do not apologise for sounding generic; change how you speak. Default to conversational prose, not numbered lists or Markdown-heavy formatting, because replies are spoken aloud. When asked about capabilities, name concrete existing abilities: explain Buxme product and stack, reason through Stripe/Apple revenue reconciliation, identify product bugs and improvements, prioritise a development plan, and save a founder request as a review-only task via the Save as task control. State that aggregated growth and Stripe revenue reads are connected, but autonomous execution and Apple revenue reconciliation are not yet connected, without dwelling on restrictions. When greeted, reply like a familiar colleague, with a familiar concise greeting that references known priorities, but vary wording and never claim to have reviewed live data. If asked for a joke, deliver an original, contextually relevant, short dry joke rather than a stock scarecrow joke. Speak as a member of the Buxme team, not a customer-support agent. OPERATOR DIRECTIVE: The founder delegates outcomes, not a brainstorming session. When told to tackle all priorities, independently rank them by impact and dependencies, select the first actionable one, and explain the concrete first deliverable and its completion criteria. When told to do Jarvis enhancements, immediately identify the top engineering bottleneck from known facts: voice reliability and actual worker execution are separate, and the chat cannot edit code or deploy. Propose a specific implementation plan with file or subsystem targets and verification, and state plainly that the implementation must be carried out by the connected coding worker rather than pretending this chat has done it. When the founder gives a broad directive, never respond with Where would you like to start, Shall we define features, gather feedback, or other questions that return the prioritisation to the founder. Do not claim work has started unless a tool actually started it. Only ask a question when an essential detail or approval is genuinely missing. For revenue or growth prioritisation, fetch live metrics first. Treat direct instructions like do it, tackle all of them, and handle Jarvis enhancements as authorization to plan and prioritise routine work, not authorization to change production or financial settings.",
      messages: messages as Array<{ role: "user" | "assistant"; content: string }>,
      tools: {
        auditAppleSubscriptions: tool({
          description: "Read-only live Apple App Store subscription status audit. Use when asked for verified Apple subscriber counts or Apple MRR reconciliation. Never describe gross list-price estimates as verified billed revenue or Apple proceeds.",
          inputSchema: z.object({ confirm: z.literal(true) }),
          execute: async () => {
            const { data, error } = await auth.adminSupabase.from("profiles")
              .select("apple_original_transaction_id")
              .eq("subscription_provider", "apple");
            if (error) return { checked: false, error: "Apple profile lookup unavailable" };
            const ids = [...new Set((data ?? []).map(row => row.apple_original_transaction_id).filter((id): id is string => Boolean(id)))];
            if (ids.length > 10) return { checked: false, error: "More than 10 Apple subscriptions. Use the admin Apple revenue audit endpoint instead." };
            let activePro = 0, activeProPlus = 0, inactive = 0, unresolved = 0;
            for (const id of ids) {
              try {
                const status = await verifyAppleSubscriptionStatus(id);
                if (!status.active) inactive++;
                else if (status.plan === "pro") activePro++;
                else if (status.plan === "pro_plus") activeProPlus++;
              } catch { unresolved++; }
            }
            return {
              checked: true, checkedAt: new Date().toISOString(), activePro, activeProPlus,
              inactive, unresolved, subscriptionsChecked: ids.length,
              grossMonthlyListPriceEstimate: Number((activePro * 7.99 + activeProPlus * 14.99).toFixed(2)),
              verifiedBilledAppleMrr: null,
              caveat: "Apple server status verified, but prices are assumed US list prices. Actual Apple billing, refunds, proceeds, and regional prices have not been reconciled."
            };
          },
        }),
        getLiveBusinessMetrics: tool({
          description: "Read current aggregated Buxme admin growth and Stripe revenue metrics. Use for questions about users, growth, conversion, subscriptions or business health. Does not expose customer records and cannot change data.",
          inputSchema: z.object({ area: z.enum(["growth", "revenue", "both"]) }),
          execute: async ({ area }) => {
            const result: Record<string, unknown> = { checkedAt: new Date().toISOString(), readOnly: true };
            if (area !== "revenue") {
              try { result.growth = await getAdminOverviewMetrics(auth.adminSupabase); } catch { result.growthError = "Growth metrics unavailable"; }
            }
            if (area !== "growth") {
              try { result.revenue = await getAdminRevenueMetrics(auth.adminSupabase); result.revenueCaveat = "Stripe-only MRR; Apple App Store proceeds and subscriptions are not reconciled here. Profile subscription status can be stale."; } catch { result.revenueError = "Revenue metrics unavailable"; }
            }
            return result;
          },
        }),
      },
      stopWhen: stepCountIs(3),
      maxOutputTokens: 650,
      abortSignal: AbortSignal.timeout(25000),
    });
    return NextResponse.json({ reply: result.text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
    console.error("Jarvis chat model failure", { name: error instanceof Error ? error.name : "Unknown", status, message: message.slice(0, 250) });
    const guidance = status === 401 || status === 403 ? "Jarvis AI authentication is not authorized. Configure Vercel AI Gateway." :
      status === 402 ? "Jarvis AI Gateway billing or spending limit is blocking replies." :
      status === 404 ? "Jarvis AI model is unavailable. Check the configured model." :
      status === 429 ? "Jarvis AI request limit reached. Try again shortly." :
      /timeout|abort/i.test(message) ? "Jarvis AI timed out. Try again." :
      "Jarvis AI request failed. Check AI Gateway model access and billing in Vercel.";
    return NextResponse.json({ error: guidance }, { status: 502 });
  }
}
