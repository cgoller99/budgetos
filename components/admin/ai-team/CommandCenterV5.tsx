"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { AI_TEAM_CAPABILITIES } from "@/lib/ai-team/capabilities";
import type {
  AiTeamActivityEvent,
  AiTeamAgentId,
  AiTeamApprovalDecision,
  AiTeamAutonomyLevel,
  AiTeamMission,
  AiTeamPlanningUsage,
  AiTeamRun,
  AiTeamRuntimeInfo,
  AiTeamScreenAnalysis,
  AiTeamSnapshot,
} from "@/lib/ai-team/types";
import {
  AGENT_ICONS,
  AGENT_LABELS,
  BUILT_IN_PLAYBOOKS,
  relativeTime,
} from "./shared";
import {
  useMissionVoice,
  useScreenAwareness,
} from "./browserInterfaces";

type Props = {
  goal: string;
  setGoal: (goal: string) => void;
  createPlan: (
    context?: Record<string, unknown>,
    commandOverride?: string,
  ) => void;
  planning: boolean;
  activity: AiTeamActivityEvent[];
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
  runs: AiTeamRun[];
  approvalRuns: AiTeamRun[];
  decisions: AiTeamApprovalDecision[];
  planningUsage: AiTeamPlanningUsage;
  agentCount: number;
  onRefresh: () => void;
  refreshing: boolean;
  missions: AiTeamMission[];
  currentMission: AiTeamMission | null;
  autonomyLevel: AiTeamAutonomyLevel;
  setAutonomyLevel: (level: AiTeamAutonomyLevel) => void;
  onStopSession: () => Promise<string>;
};

const AGENT_IDS = Object.keys(AGENT_LABELS) as AiTeamAgentId[];
const AGENT_POSITIONS = [
  "left-1/2 top-0 -translate-x-1/2",
  "right-[8%] top-[15%]",
  "right-0 top-1/2 -translate-y-1/2",
  "bottom-[15%] right-[8%]",
  "bottom-0 left-1/2 -translate-x-1/2",
  "bottom-[15%] left-[8%]",
  "left-0 top-1/2 -translate-y-1/2",
  "left-[8%] top-[15%]",
];

const REPORT_SECTIONS: Array<{
  key:
    | "whatWasRequested"
    | "whatTheTeamDid"
    | "whatItFound"
    | "whatChanged"
    | "filesDataActionsAffected"
    | "importantFindings"
    | "warnings"
    | "whatCouldNotBeCompleted"
    | "recommendedNextActions";
  label: string;
}> = [
  { key: "whatWasRequested", label: "What was requested" },
  { key: "whatTheTeamDid", label: "What the team did" },
  { key: "whatItFound", label: "What it found" },
  { key: "whatChanged", label: "What changed" },
  {
    key: "filesDataActionsAffected",
    label: "Files / data / actions affected",
  },
  { key: "importantFindings", label: "Important findings" },
  { key: "warnings", label: "Warnings" },
  { key: "whatCouldNotBeCompleted", label: "What could not be completed" },
  { key: "recommendedNextActions", label: "Recommended next actions" },
];

function elapsedLabel(milliseconds: number | null) {
  if (milliseconds === null) return "—";
  if (milliseconds < 1000) return `${milliseconds} ms`;
  const seconds = Math.floor(milliseconds / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function statusColor(status: string) {
  if (status === "completed" || status === "passed") return "text-emerald-300";
  if (status === "failed") return "text-rose-300";
  if (status === "partial" || status === "warning") return "text-amber-300";
  if (status === "stopped") return "text-orange-300";
  return "text-cyan-200";
}

export function CommandCenter(props: Props) {
  const {
    goal,
    setGoal,
    createPlan,
    planning,
    activity,
    runtime,
    snapshot,
    runs,
    planningUsage,
    agentCount,
    onRefresh,
    refreshing,
    missions,
    currentMission,
    autonomyLevel,
    setAutonomyLevel,
    onStopSession,
  } = props;
  const [inspectedMission, setInspectedMission] =
    useState<AiTeamMission | null>(null);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [stopNotice, setStopNotice] = useState<string | null>(null);
  const [commandMode, setCommandMode] = useState(false);
  const [screenAnalysis, setScreenAnalysis] =
    useState<AiTeamScreenAnalysis | null>(null);
  const [screenAnalyzing, setScreenAnalyzing] = useState(false);
  const [screenAnalysisError, setScreenAnalysisError] =
    useState<string | null>(null);
  const [clock, setClock] = useState(0);
  const wasListening = useRef(false);
  const screenAnalysisAbortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const voice = useMissionVoice(planning);
  const voiceMicActive = voice.micActive;
  const voiceTranscript = voice.transcript;
  const setVoiceThinking = voice.setThinking;
  const {
    supported: screenSupported,
    active: screenActive,
    error: screenError,
    setVideoElement,
    capturedFrame,
    dimensions: screenDimensions,
    enable: enableScreen,
    stop: stopScreen,
    captureFrame,
  } = useScreenAwareness();
  const reportMission = inspectedMission ?? currentMission ?? missions[0] ?? null;
  const report = reportMission?.finalReport ?? null;

  useEffect(() => {
    if (!planning) return;
    setClock(Date.now());
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [planning]);

  useEffect(() => {
    const justStopped = wasListening.current && !voiceMicActive;
    wasListening.current = voiceMicActive;
    if (justStopped && autoSubmit && voiceTranscript.trim().length >= 3) {
      setVoiceThinking();
      setGoal(voiceTranscript.trim());
      createPlan(
        {
          screenSharingActive: screenActive,
          displayWidth: screenDimensions?.width ?? 0,
          displayHeight: screenDimensions?.height ?? 0,
          commandSource: "voice",
        },
        voiceTranscript.trim(),
      );
    }
  }, [
    autoSubmit,
    createPlan,
    screenActive,
    screenDimensions,
    setGoal,
    voiceMicActive,
    setVoiceThinking,
    voiceTranscript,
  ]);

  useEffect(() => {
    const onFullscreen = () =>
      setCommandMode(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(
    () => () => screenAnalysisAbortRef.current?.abort(),
    [],
  );

  useEffect(() => {
    if (screenActive || capturedFrame) return;
    screenAnalysisAbortRef.current?.abort();
    screenAnalysisAbortRef.current = null;
    setScreenAnalysis(null);
    setScreenAnalysisError(null);
    setScreenAnalyzing(false);
  }, [capturedFrame, screenActive]);

  const events = currentMission?.events.length
    ? currentMission.events
    : activity.map((event) => ({
        id: event.id,
        missionId: "",
        createdBy: event.createdBy,
        phase: event.phase,
        eventType: event.phase,
        agentId: event.agentId,
        toolName: null,
        status: event.status,
        summary: event.label,
        detail: event.detail,
        metadata: {},
        ordinal: event.ordinal,
        occurredAt: event.createdAt,
        createdAt: event.createdAt,
      }));
  const activeAgents = useMemo(
    () =>
      new Set(
        events
          .filter((event) =>
            ["running", "completed"].includes(event.status),
          )
          .flatMap((event) => (event.agentId ? [event.agentId] : [])),
      ),
    [events],
  );
  const latestByAgent = useMemo(() => {
    const latest = new Map<AiTeamAgentId, string>();
    for (const event of events) {
      if (event.agentId) latest.set(event.agentId, event.status);
    }
    return latest;
  }, [events]);
  const elapsed =
    currentMission?.elapsedMs ??
    (currentMission?.startedAt && planning
      ? Math.max(0, clock - Date.parse(currentMission.startedAt))
      : null);

  const submitMission = () => {
    voice.setThinking();
    createPlan({
      screenSharingActive: screenActive,
      displayWidth: screenDimensions?.width ?? 0,
      displayHeight: screenDimensions?.height ?? 0,
      commandSource: "text",
    });
  };

  function turnScreenOff() {
    screenAnalysisAbortRef.current?.abort();
    screenAnalysisAbortRef.current = null;
    setScreenAnalyzing(false);
    setScreenAnalysis(null);
    setScreenAnalysisError(null);
    stopScreen();
  }

  function captureLocalFrame() {
    setScreenAnalysis(null);
    setScreenAnalysisError(null);
    return captureFrame();
  }

  async function analyzeCurrentFrame() {
    setScreenAnalysis(null);
    const frame = captureFrame();
    if (!frame) {
      setScreenAnalysisError("Capture a visible shared surface before analysis.");
      return;
    }

    screenAnalysisAbortRef.current?.abort();
    const controller = new AbortController();
    screenAnalysisAbortRef.current = controller;
    setScreenAnalyzing(true);
    setScreenAnalysisError(null);

    try {
      const response = await fetch("/api/admin/ai-team/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          frame,
          question: goal.trim()
            ? `The founder is currently working toward: ${goal.trim()}`
            : undefined,
        }),
      });
      const payload = (await response.json()) as {
        analysis?: AiTeamScreenAnalysis;
        error?: string;
      };
      if (!response.ok || !payload.analysis) {
        throw new Error(payload.error || "Screen analysis did not complete.");
      }
      setScreenAnalysis(payload.analysis);
    } catch (error) {
      if (controller.signal.aborted) return;
      setScreenAnalysisError(
        error instanceof Error ? error.message : "Screen analysis failed.",
      );
    } finally {
      if (screenAnalysisAbortRef.current === controller) {
        screenAnalysisAbortRef.current = null;
        setScreenAnalyzing(false);
      }
    }
  }

  function useScreenFindings() {
    if (!screenAnalysis) return;
    const evidence = [
      screenAnalysis.summary,
      ...screenAnalysis.observations.slice(0, 3),
    ].join(" ");
    const prefix = goal.trim() ? `${goal.trim()}\n\n` : "";
    setGoal(
      `${prefix}Screen evidence approved by founder: ${evidence}`.slice(
        0,
        1000,
      ),
    );
  }

  async function openMission(id: string) {
    try {
      const response = await fetch(
        `/api/admin/ai-team/missions?id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { mission?: AiTeamMission };
      if (response.ok && payload.mission) setInspectedMission(payload.mission);
    } catch {
      // Mission history remains usable even if one detail refresh fails.
    }
  }

  async function stopSession() {
    voice.stopListening();
    voice.stopSpeaking();
    turnScreenOff();
    setStopNotice(await onStopSession());
  }

  async function toggleCommandMode() {
    if (!document.fullscreenEnabled || !rootRef.current) {
      setStopNotice("Fullscreen Command Mode is unavailable in this browser.");
      return;
    }
    if (document.fullscreenElement) await document.exitFullscreen();
    else await rootRef.current.requestFullscreen();
  }

  const coreState =
    currentMission?.status ??
    (planning ? "planning" : events.some((event) => event.status === "failed")
      ? "failed"
      : "standby");
  const noExecutor =
    autonomyLevel === "act" || autonomyLevel === "autopilot";

  return (
    <div
      ref={rootRef}
      className={`relative isolate overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#020710] text-slate-100 shadow-[0_35px_110px_rgba(1,8,20,.5)] ${
        commandMode ? "h-screen overflow-y-auto rounded-none" : ""
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.045) 1px,transparent 1px),radial-gradient(circle at 50% 35%,rgba(14,165,233,.12),transparent 38%)",
          backgroundSize: "38px 38px,38px 38px,100% 100%",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent_0_4px,rgba(186,230,253,.018)_5px)]" />

      <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-cyan-200/10 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="accent">Buxme OS V5.2</Badge>
            <span className={`text-[10px] uppercase tracking-[.18em] ${runtime.mode === "ai" ? "text-emerald-300" : "text-amber-300"}`}>
              {runtime.mode === "ai" ? "AI runtime available" : "Deterministic fallback"}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-[.16em] text-white">
            MISSION ENGINE + SCREEN INTELLIGENCE
          </h2>
          <p className="mt-1 text-[10px] text-slate-500">
            Perception → reasoning → team → memory → tools → action → verification → report
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={toggleCommandMode}>
            {commandMode ? "Exit Command Mode" : "Command Mode"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Syncing…" : "Sync"}
          </Button>
          <button
            type="button"
            onClick={() => void stopSession()}
            className="focus-ring rounded-xl border border-rose-400/50 bg-rose-500/15 px-4 py-2 text-xs font-bold tracking-[.12em] text-rose-100 hover:bg-rose-500/25"
          >
            EMERGENCY STOP
          </button>
        </div>
      </header>

      {stopNotice ? (
        <div className="relative border-b border-amber-300/20 bg-amber-300/10 px-5 py-2 text-xs text-amber-100">
          {stopNotice}
        </div>
      ) : null}

      <div className="relative grid gap-4 p-4 2xl:grid-cols-[minmax(260px,.78fr)_minmax(430px,1.35fr)_minmax(300px,.87fr)]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-cyan-200/15 bg-slate-950/65 p-4">
            <p className="text-[9px] uppercase tracking-[.2em] text-cyan-200/55">
              Current mission
            </p>
            <p className="mt-2 line-clamp-3 text-sm font-medium text-white">
              {currentMission?.command ?? (planning ? goal : "Awaiting command")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
              {[
                ["Status", currentMission?.status ?? (planning ? "planning" : "standby")],
                ["Elapsed", elapsedLabel(elapsed)],
                ["Agents", String(activeAgents.size)],
                ["Tools", String(new Set(events.flatMap((event) => event.toolName ? [event.toolName] : [])).size)],
                ["Actions", String(currentMission?.changes.length ?? 0)],
                ["Verified", currentMission?.verified ? "yes" : "no"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-cyan-200/10 bg-cyan-100/[.025] p-2">
                  <p className="text-slate-600">{label}</p>
                  <p className={`mt-1 truncate font-mono ${label === "Status" ? statusColor(value) : "text-slate-300"}`}>{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="max-h-[430px] overflow-y-auto rounded-2xl border border-cyan-200/15 bg-slate-950/65 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-[.2em] text-cyan-200/55">
                Live intelligence
              </p>
              <span className="font-mono text-[9px] text-slate-600">{events.length}</span>
            </div>
            {events.length ? (
              <ol className="mt-3 space-y-3" aria-live="polite">
                {events.map((event) => (
                  <li key={event.id} className="border-l border-cyan-300/20 pl-3">
                    <div className="flex justify-between gap-2">
                      <p className="text-[11px] text-slate-200">{event.summary}</p>
                      <span className={`text-[8px] uppercase ${statusColor(event.status)}`}>{event.status}</span>
                    </div>
                    {event.detail ? <p className="mt-1 text-[9px] leading-relaxed text-slate-500">{event.detail}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-xs text-slate-600">Persisted mission events appear here.</p>
            )}
          </section>

          <section className="rounded-2xl border border-cyan-200/15 bg-slate-950/65 p-4">
            <p className="text-[9px] uppercase tracking-[.2em] text-cyan-200/55">Mission history</p>
            <div className="mt-3 space-y-2">
              {missions.slice(0, 8).map((mission) => (
                <button
                  type="button"
                  key={mission.id}
                  onClick={() => void openMission(mission.id)}
                  className="focus-ring block w-full rounded-lg border border-cyan-200/10 p-2 text-left hover:border-cyan-200/30"
                >
                  <p className="line-clamp-1 text-[11px] text-slate-300">{mission.command}</p>
                  <p className="mt-1 flex justify-between text-[8px] text-slate-600">
                    <span className={statusColor(mission.status)}>{mission.status}</span>
                    <span>{relativeTime(mission.createdAt)}</span>
                  </p>
                </button>
              ))}
              {!missions.length ? <p className="text-xs text-slate-600">No missions yet.</p> : null}
            </div>
          </section>
        </aside>

        <main className="space-y-4">
          <section className="rounded-2xl border border-cyan-200/15 bg-slate-950/55 p-4">
            <div className="relative mx-auto aspect-square w-full max-w-[540px]" aria-label={`AI core state: ${coreState}`}>
              <div className="absolute inset-[8%] rounded-full border border-cyan-300/15 shadow-[inset_0_0_80px_rgba(14,165,233,.08),0_0_60px_rgba(14,165,233,.06)]" />
              <div className="absolute inset-[14%] animate-[spin_28s_linear_infinite] rounded-full border border-dashed border-cyan-300/20 motion-reduce:animate-none" />
              <div className="absolute inset-[25%] animate-[spin_16s_linear_infinite_reverse] rounded-full border border-cyan-200/20 motion-reduce:animate-none" />
              {AGENT_IDS.map((id, index) => {
                const state = latestByAgent.get(id) ?? "idle";
                return (
                  <div key={id} className={`absolute z-20 flex w-20 flex-col items-center gap-1 ${AGENT_POSITIONS[index]}`}>
                    <span className={`grid size-10 place-items-center rounded-full border ${
                      state === "running"
                        ? "animate-pulse border-cyan-100 bg-cyan-300/25 text-white shadow-[0_0_28px_rgba(34,211,238,.55)] motion-reduce:animate-none"
                        : state === "completed"
                          ? "border-emerald-300/55 bg-emerald-300/10 text-emerald-100"
                          : state === "failed"
                            ? "border-rose-300/50 text-rose-200"
                            : "border-slate-700 bg-slate-950 text-slate-600"
                    }`}>{AGENT_ICONS[id]}</span>
                    <span className="text-center text-[8px] text-slate-500">{AGENT_LABELS[id]}</span>
                  </div>
                );
              })}
              <div className={`absolute inset-[34%] z-10 grid place-items-center rounded-full border bg-[radial-gradient(circle,rgba(14,165,233,.18),rgba(2,8,18,.98)_68%)] text-center shadow-[0_0_55px_rgba(14,165,233,.18)] ${
                coreState === "failed" ? "border-rose-400/60" : coreState === "completed" ? "border-emerald-300/60" : "border-cyan-200/50"
              }`}>
                <div>
                  <span className={`mx-auto block size-2 rounded-full ${planning ? "animate-pulse bg-cyan-200 motion-reduce:animate-none" : "bg-cyan-300/40"}`} />
                  <p className="mt-3 text-[9px] uppercase tracking-[.2em] text-cyan-100/55">AI Core</p>
                  <p className={`mt-1 text-xs font-semibold uppercase ${statusColor(coreState)}`}>{coreState}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-cyan-200/20 bg-[#01050d]/90 p-4">
            <div className="flex flex-wrap gap-2">
              {BUILT_IN_PLAYBOOKS.slice(0, 5).map((playbook) => (
                <button key={playbook.title} type="button" disabled={planning} onClick={() => setGoal(playbook.goalTemplate)} className="rounded-full border border-cyan-200/10 px-3 py-1 text-[9px] text-slate-500 hover:text-cyan-100">
                  {playbook.title}
                </button>
              ))}
            </div>
            <label htmlFor="ai-goal" className="mt-3 block text-[9px] uppercase tracking-[.2em] text-cyan-200/55">Command composer</label>
            <textarea
              id="ai-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  submitMission();
                }
              }}
              maxLength={1000}
              rows={4}
              placeholder="What should the team investigate, challenge, or plan?"
              className="focus-ring mt-2 w-full resize-y rounded-xl border border-cyan-200/15 bg-slate-950/80 p-3 text-sm text-white outline-none placeholder:text-slate-700"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[9px] text-slate-600">{goal.length}/1000 · planning/staging only</p>
              <Button onClick={submitMission} disabled={planning || goal.trim().length < 3}>
                {planning ? "Mission active…" : "Start mission"}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-cyan-200/15 bg-slate-950/55 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-[.2em] text-cyan-200/55">Capability registry</p>
              <span className="text-[8px] text-slate-600">No unrestricted executor</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {AI_TEAM_CAPABILITIES.map((capability) => (
                <div key={capability.id} className="rounded-lg border border-cyan-200/10 p-2">
                  <div className="flex justify-between gap-2">
                    <p className="text-[10px] text-slate-300">{capability.label}</p>
                    <span className={`text-[8px] uppercase ${capability.available ? "text-emerald-300" : "text-slate-600"}`}>
                      {capability.available ? "available" : "planned"}
                    </span>
                  </div>
                  <p className="mt-1 text-[8px] leading-relaxed text-slate-600">{capability.description}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-cyan-200/15 bg-slate-950/65 p-4">
            <div className="flex justify-between gap-3">
              <p className="text-[9px] uppercase tracking-[.2em] text-cyan-200/55">Screen intelligence</p>
              <span className={`text-[9px] font-semibold ${screenActive ? "text-emerald-300" : "text-slate-600"}`}>
                {screenActive ? "● SCREEN ACTIVE" : "OFF"}
              </span>
            </div>
            <video
              ref={setVideoElement}
              muted
              playsInline
              className={`mt-3 aspect-video w-full rounded-lg border border-cyan-200/10 bg-black object-contain ${screenActive ? "block" : "hidden"}`}
            />
            {!screenActive ? (
              <p className="mt-3 rounded-lg border border-dashed border-cyan-200/10 p-5 text-center text-[9px] text-slate-600">
                No shared surface. The AI has not analyzed your screen.
              </p>
            ) : null}
            <p className="mt-3 text-[8px] leading-relaxed text-slate-500">
              Analyze Frame sends one compressed screenshot to Buxme&apos;s configured AI runtime/provider.
              This Buxme feature does not write the screenshot to app storage or mission history.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => void enableScreen()} disabled={!screenSupported || screenActive}>
                Enable screen access
              </Button>
              <Button size="sm" variant="ghost" onClick={turnScreenOff} disabled={!screenActive}>
                Screen OFF
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void captureLocalFrame()} disabled={!screenActive}>
                Capture locally
              </Button>
              <Button size="sm" onClick={() => void analyzeCurrentFrame()} disabled={!screenActive || screenAnalyzing}>
                {screenAnalyzing ? "Analyzing…" : "Analyze frame"}
              </Button>
            </div>
            {capturedFrame && !screenAnalysis ? (
              <p className="mt-2 text-[8px] text-emerald-300">
                Frame captured. It stays local unless you press Analyze frame.
              </p>
            ) : null}
            {screenAnalysis ? (
              <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[8px] font-semibold uppercase tracking-[.16em] text-cyan-100/60">
                    Visual understanding
                  </p>
                  <span className="text-[8px] text-emerald-300">NOT SAVED BY BUXME</span>
                </div>
                {screenAnalysis.surface ? (
                  <p className="mt-2 text-[9px] text-slate-500">{screenAnalysis.surface}</p>
                ) : null}
                <p className="mt-1 text-[10px] leading-relaxed text-slate-200">{screenAnalysis.summary}</p>
                {screenAnalysis.observations.length ? (
                  <ul className="mt-2 space-y-1">
                    {screenAnalysis.observations.slice(0, 5).map((item) => (
                      <li key={item} className="text-[9px] leading-relaxed text-slate-400">• {item}</li>
                    ))}
                  </ul>
                ) : null}
                {screenAnalysis.interactiveElements.length ? (
                  <div className="mt-3">
                    <p className="text-[8px] uppercase tracking-[.14em] text-slate-600">Visible controls</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {screenAnalysis.interactiveElements.slice(0, 6).map((item) => (
                        <span key={`${item.label}-${item.location}`} className="rounded border border-cyan-200/10 px-2 py-1 text-[8px] text-slate-500">
                          {item.label} · {item.location}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {screenAnalysis.suggestedNextActions.length ? (
                  <div className="mt-3">
                    <p className="text-[8px] uppercase tracking-[.14em] text-slate-600">Suggested next</p>
                    <ul className="mt-1 space-y-1">
                      {screenAnalysis.suggestedNextActions.slice(0, 3).map((item) => (
                        <li key={item} className="text-[9px] leading-relaxed text-cyan-100/65">→ {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {screenAnalysis.sensitiveContentDetected ? (
                  <p className="mt-2 text-[8px] text-amber-300">
                    Sensitive-looking content was detected and its value was not reproduced.
                  </p>
                ) : null}
                {screenAnalysis.warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-[8px] text-amber-300">{warning}</p>
                ))}
                <Button size="sm" variant="ghost" onClick={useScreenFindings} className="mt-3">
                  Use findings in mission
                </Button>
                <p className="mt-1 text-[8px] text-slate-600">
                  Using findings adds the text summary to the command; that command will be persisted if you start the mission.
                </p>
              </div>
            ) : null}
            {screenAnalysisError ? <p className="mt-2 text-[9px] text-amber-300">{screenAnalysisError}</p> : null}
            {screenError ? <p className="mt-2 text-[9px] text-amber-300">{screenError}</p> : null}
          </section>

          <section className="rounded-2xl border border-cyan-200/15 bg-slate-950/65 p-4">
            <div className="flex justify-between gap-3">
              <p className="text-[9px] uppercase tracking-[.2em] text-cyan-200/55">Voice interface</p>
              <span className={`${voice.micActive ? "text-rose-300" : "text-slate-600"} text-[9px] font-semibold`}>{voice.micActive ? "● MIC ACTIVE" : voice.phase}</span>
            </div>
            <p className="mt-3 text-[9px] leading-relaxed text-slate-500">
              Browser Web Speech implementations may process audio or transcripts
              using the browser or platform speech service. Buxme does not persist
              microphone audio in this release.
            </p>
            <div className="mt-3 flex h-10 items-end gap-1 rounded-lg border border-cyan-200/10 bg-black/30 p-2" aria-label={`Microphone level ${Math.round(voice.micLevel * 100)} percent`}>
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} className="flex-1 rounded-sm bg-cyan-300/60 transition-[height] motion-reduce:transition-none" style={{ height: `${Math.max(8, voice.micLevel * 100 * ((index % 4 + 1) / 4))}%` }} />
              ))}
            </div>
            <textarea readOnly value={voice.transcript} rows={3} placeholder={voice.supported ? "Push to talk…" : "Web Speech is unsupported in this browser."} className="mt-3 w-full resize-none rounded-lg border border-cyan-200/10 bg-slate-950 p-2 text-[10px] text-slate-300 outline-none placeholder:text-slate-700" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void voice.startListening()} disabled={!voice.supported || voice.micActive}>Push to talk</Button>
              <Button size="sm" variant="ghost" onClick={voice.stopListening} disabled={!voice.micActive}>Mic OFF</Button>
              <Button size="sm" variant="ghost" onClick={() => setGoal(voice.transcript)} disabled={!voice.transcript.trim()}>Use transcript</Button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[9px] text-slate-500">
              <input type="checkbox" checked={autoSubmit} onChange={(event) => setAutoSubmit(event.target.checked)} />
              Auto-submit after speech (off by default)
            </label>
          </section>

          <section className="rounded-2xl border border-cyan-200/15 bg-slate-950/65 p-4">
            <p className="text-[9px] uppercase tracking-[.2em] text-cyan-200/55">Autonomy policy</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["observe", "assist", "act", "autopilot"] as const).map((level) => (
                <button key={level} type="button" onClick={() => setAutonomyLevel(level)} className={`focus-ring rounded-lg border p-2 text-[10px] capitalize ${autonomyLevel === level ? "border-cyan-200/50 bg-cyan-300/10 text-cyan-100" : "border-cyan-200/10 text-slate-600"}`}>
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[9px] leading-relaxed text-slate-500">
              {autonomyLevel === "observe"
                ? "Read and plan only."
                : autonomyLevel === "assist"
                  ? "Recommendations and approval-gated staging."
                  : "Policy selected for future use. No external/local action executor connected."}
            </p>
            {noExecutor ? <p className="mt-2 font-semibold text-[9px] text-amber-300">No actions will execute.</p> : null}
          </section>

          <section className="max-h-[700px] overflow-y-auto rounded-2xl border border-cyan-200/20 bg-[linear-gradient(160deg,rgba(6,31,51,.7),rgba(2,8,18,.98)_55%)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[.2em] text-cyan-200/55">Mission debrief</p>
                <p className="mt-1 text-xs font-semibold text-white">{report?.status ?? "Awaiting report"}</p>
              </div>
              {report ? <Button size="sm" variant="ghost" onClick={() => voice.speak([report.status, ...report.whatTheTeamDid, ...report.warnings].join(". "))}>Speak</Button> : null}
            </div>
            {report ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  <div><p className="text-slate-600">Command</p><p className="mt-1 text-slate-300">{report.command}</p></div>
                  <div><p className="text-slate-600">Elapsed time</p><p className="mt-1 text-slate-300">{elapsedLabel(report.elapsedTimeMs)}</p></div>
                  <div className="col-span-2"><p className="text-slate-600">Agents used</p><p className="mt-1 text-slate-300">{report.agentsUsed.join(", ") || "None"}</p></div>
                </div>
                {REPORT_SECTIONS.map((section) => {
                  const items = report[section.key];
                  const noChanges = section.key === "whatChanged" && items[0] === "No changes were made.";
                  return (
                    <div key={section.key} className={noChanges ? "rounded-lg border border-emerald-300/25 bg-emerald-300/[.06] p-3" : ""}>
                      <p className="text-[8px] font-semibold uppercase tracking-[.15em] text-cyan-100/45">{section.label}</p>
                      {items.length ? <ul className="mt-1 space-y-1">{items.map((item) => <li key={item} className={`text-[9px] leading-relaxed ${noChanges ? "font-semibold text-emerald-200" : "text-slate-400"}`}>{item}</li>)}</ul> : <p className="mt-1 text-[9px] text-slate-700">None.</p>}
                    </div>
                  );
                })}
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[.15em] text-cyan-100/45">Verification results</p>
                  <div className="mt-2 space-y-1">
                    {report.verificationResults.map((check) => (
                      <div key={check.checkType} className="flex justify-between gap-3 text-[9px]">
                        <span className="text-slate-500">{check.summary}</span>
                        <span className={statusColor(check.status)}>{check.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[10px] leading-relaxed text-slate-600">The deterministic intelligence report appears after persistence and verification. Hidden reasoning is never displayed.</p>
            )}
          </section>

          <p className="px-1 text-[8px] text-slate-700">
            {agentCount} agents · {runs.length} recent runs · planning {planningUsage.used}/{planningUsage.limit} · evidence {relativeTime(snapshot.generatedAt)}
          </p>
        </aside>
      </div>
    </div>
  );
}
