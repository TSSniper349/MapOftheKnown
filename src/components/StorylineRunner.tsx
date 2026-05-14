import { useEffect, useMemo, useRef } from 'react';
import type { PreparedNode } from '../App';
import { STORYLINE_BY_ID, STORYLINES } from '../data/storylines';
import type { UIActions, UIState } from '../hooks/useUIState';
import { formatYear } from '../lib/timeScale';

interface StorylineRunnerProps {
  nodes: PreparedNode[];
  ui: UIState & UIActions;
}

const AUTO_ADVANCE_MS = 4500;

/**
 * Renders both the picker (in the top region) and the active-storyline banner
 * (floating along the top of the canvas) plus the side-effect that drives time
 * window + selection from the current step.
 */
export function StorylineRunner({ nodes, ui }: StorylineRunnerProps) {
  const storyline = ui.storylineId ? STORYLINE_BY_ID.get(ui.storylineId) ?? null : null;
  const step = storyline ? storyline.steps[ui.storylineStep] : null;
  const event = useMemo(
    () => (step ? nodes.find((n) => n.raw.id === step.eventId) ?? null : null),
    [step, nodes],
  );

  /* Drive selection + year window from current step. */
  const lastApplied = useRef<string | null>(null);
  useEffect(() => {
    if (!storyline || !step || !event) return;
    const key = `${storyline.id}#${ui.storylineStep}`;
    if (lastApplied.current === key) return;
    lastApplied.current = key;
    ui.selectNode(event.raw.id);
    // Pan a roughly century-wide window centered on the event so neighboring
    // events stay visible — keeps the user's bearings.
    const half = 60;
    ui.setYearWindow([event.year - half, event.year + half]);
    ui.triggerPulse(event.raw.id);
  }, [storyline, step, event, ui]);

  /* Auto-advance timer */
  useEffect(() => {
    if (!storyline || !ui.storylineAuto) return;
    const handle = window.setTimeout(() => {
      if (ui.storylineStep >= storyline.steps.length - 1) {
        ui.toggleStorylineAuto();
      } else {
        ui.nextStorylineStep();
      }
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(handle);
  }, [storyline, ui.storylineAuto, ui.storylineStep, ui]);

  /* Keyboard ←/→ to step while a storyline is active. */
  useEffect(() => {
    if (!storyline) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        ui.nextStorylineStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        ui.prevStorylineStep();
      } else if (e.key === 'Escape') {
        ui.exitStoryline();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [storyline, ui]);

  if (!storyline || !step) return null;
  const total = storyline.steps.length;
  const idx = ui.storylineStep;
  const eventYear = event ? formatYear(event.year) : '';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
      <div className="pointer-events-auto max-w-[min(720px,calc(100%-32px))] rounded-md border border-domain-medicine/40 bg-parchment-50/95 px-4 py-3 shadow-card backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-domain-medicine">
              Storyline · step {idx + 1} of {total}
            </div>
            <div className="font-serif text-base leading-tight text-ink-900">
              {storyline.title}
              <span className="ml-2 font-serif text-[12px] italic text-ink-500">
                {storyline.subtitle}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => ui.exitStoryline()}
            className="shrink-0 rounded-md border border-parchment-300 bg-parchment-50 px-2 py-0.5 font-sans text-[11px] text-ink-600 hover:bg-parchment-200"
            aria-label="Exit storyline"
            title="Exit (Esc)"
          >
            exit
          </button>
        </div>

        {event && (
          <div className="mt-2 border-l-2 pl-3" style={{ borderColor: 'rgba(122,46,58,0.45)' }}>
            <div className="font-serif text-[15px] leading-snug text-ink-900">
              {event.raw.label}
              <span className="ml-2 font-sans text-[11px] text-ink-500">{eventYear}</span>
            </div>
            <p className="mt-0.5 font-serif text-[13px] leading-snug text-ink-600">{step.note}</p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => ui.prevStorylineStep()}
              disabled={idx === 0}
              className="rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-sans text-[11px] text-ink-700 hover:bg-parchment-200 disabled:cursor-not-allowed disabled:opacity-50"
              title="Previous (←)"
            >
              ← prev
            </button>
            <button
              type="button"
              onClick={() => ui.nextStorylineStep()}
              disabled={idx >= total - 1}
              className="rounded-md border border-parchment-300 bg-parchment-50 px-2 py-1 font-sans text-[11px] text-ink-700 hover:bg-parchment-200 disabled:cursor-not-allowed disabled:opacity-50"
              title="Next (→)"
            >
              next →
            </button>
            <button
              type="button"
              onClick={() => ui.toggleStorylineAuto()}
              className={`ml-2 rounded-md border px-2 py-1 font-sans text-[11px] ${
                ui.storylineAuto
                  ? 'border-domain-medicine bg-domain-medicine text-parchment-50'
                  : 'border-parchment-300 bg-parchment-50 text-ink-700 hover:bg-parchment-200'
              }`}
              aria-pressed={ui.storylineAuto}
              title="Auto-advance"
            >
              {ui.storylineAuto ? '❚❚ auto' : '▶ auto'}
            </button>
          </div>
          <Dots total={total} idx={idx} onClick={(i) => ui.setStorylineStep(i)} />
        </div>
      </div>
    </div>
  );
}

function Dots({ total, idx, onClick }: { total: number; idx: number; onClick: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onClick(i)}
          aria-label={`Go to step ${i + 1}`}
          className={`h-1.5 rounded-full transition-all ${
            i === idx ? 'w-5 bg-domain-medicine' : 'w-1.5 bg-parchment-300 hover:bg-parchment-400'
          }`}
        />
      ))}
    </div>
  );
}

/** Picker chip rendered inside ControlsPanel. */
export function StorylinePicker({ ui }: { ui: UIState & UIActions }) {
  return (
    <div className="space-y-1.5">
      {STORYLINES.map((s) => {
        const active = ui.storylineId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => (active ? ui.exitStoryline() : ui.startStoryline(s.id))}
            className={`group w-full rounded-md border px-2.5 py-1.5 text-left transition-colors ${
              active
                ? 'border-domain-medicine bg-domain-medicine/10'
                : 'border-parchment-300 bg-parchment-50 hover:bg-parchment-200/70'
            }`}
            aria-pressed={active}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`font-serif text-[13px] leading-tight ${active ? 'text-ink-900' : 'text-ink-800'}`}
              >
                {s.title}
              </span>
              <span className="font-sans text-[10px] text-ink-400">{s.steps.length} steps</span>
            </div>
            <div className="mt-0.5 font-serif text-[11px] italic text-ink-500">{s.subtitle}</div>
          </button>
        );
      })}
    </div>
  );
}
