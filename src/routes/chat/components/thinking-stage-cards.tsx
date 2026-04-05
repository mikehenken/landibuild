import clsx from 'clsx';
import { Check, ChevronRight, Circle, Loader2, MonitorPlay } from 'lucide-react';
import type { ProjectStage } from '../utils/project-stage-helpers';

/** Row height for each plan item (design spec): 40px */
const PLAN_ROW_HEIGHT_CLASS = 'h-10';

/** Subtle border ~30% white (design spec). */
const PLAN_ROW_BORDER = 'border-[rgba(255,255,255,0.3)]';

function StatusGlyph({ status }: { status: ProjectStage['status'] }) {
	if (status === 'completed') {
		return <Check className="size-3.5 shrink-0 text-emerald-500" strokeWidth={2.5} aria-hidden />;
	}
	if (status === 'active') {
		return <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" strokeWidth={2} aria-hidden />;
	}
	if (status === 'error') {
		return <Circle className="size-3.5 shrink-0 fill-red-500/90 text-red-500" strokeWidth={2} aria-hidden />;
	}
	return <div className="size-2 rounded-full bg-white/28" aria-hidden />;
}

export function ThinkingStageCards({ stages }: { stages: ProjectStage[] }) {
	if (stages.length === 0) return null;

	return (
		<div className="flex w-full max-w-[718px] flex-col">
			{stages.map((stage, index) => {
				const isActive = stage.status === 'active';
				const isDone = stage.status === 'completed';
				const isFirst = index === 0;

				return (
					<div key={stage.id} className="flex min-w-0 gap-3">
						{/* Journey rail: dashed spine + step marker (reference layout) */}
						<div className="relative flex w-9 shrink-0 flex-col items-center pt-1">
							{index < stages.length - 1 ? (
								<div
									className="absolute left-1/2 top-4 bottom-0 z-0 w-0 -translate-x-1/2 border-l border-dashed border-white/[0.22]"
									aria-hidden
								/>
							) : null}
							<div
								className={clsx(
									'relative z-10 flex items-center justify-center rounded-md bg-bg-3/95 ring-1',
									isFirst ? 'size-7' : 'size-6',
									isActive ? 'ring-accent/30' : 'ring-white/[0.12]',
								)}
							>
								{isFirst ? (
									<MonitorPlay className="size-3.5 text-text-secondary" strokeWidth={2} aria-hidden />
								) : (
									<StatusGlyph status={stage.status} />
								)}
							</div>
						</div>

						{/* Plan row: 40px, rounded, rgba 0.3 border */}
						<div
							className={clsx(
								'mb-2 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3',
								PLAN_ROW_HEIGHT_CLASS,
								PLAN_ROW_BORDER,
								'bg-bg-2/40 backdrop-blur-[2px]',
								isActive && 'ring-1 ring-accent/22',
								isDone && !isActive && 'opacity-[0.93]',
							)}
						>
							{isFirst ? <StatusGlyph status={stage.status} /> : null}
							<div className="min-w-0 flex-1 truncate text-[13px] leading-tight">
								<span
									className={clsx(
										'font-medium',
										isDone && 'text-text-primary/88',
										isActive && 'text-text-primary',
										!isDone && !isActive && 'text-text-secondary/90',
									)}
								>
									{stage.title}
								</span>
								{stage.metadata ? (
									<>
										<span className="mx-1.5 font-normal text-text-tertiary/60">|</span>
										<span className="font-normal text-text-tertiary/72">{stage.metadata}</span>
									</>
								) : null}
							</div>
							<ChevronRight className="size-4 shrink-0 text-text-tertiary/45" strokeWidth={2} aria-hidden />
						</div>
					</div>
				);
			})}
		</div>
	);
}

/**
 * Strips leading narrative before the first markdown list, so we do not duplicate
 * bootstrap/blueprint/code bullets when structured stage cards are shown.
 */
export function extractThinkingHeadline(content: string): string {
	const trimmed = content.trim();
	if (!trimmed) return '';

	const listStart = trimmed.search(/\n\s*[*\-•]\s/m);
	if (listStart === -1) return trimmed;

	const head = trimmed.slice(0, listStart).trim();
	return head || trimmed;
}

/**
 * True when assistant text is the bootstrap/blueprint/code bullet list duplicated in markdown
 * (legacy conversation_response stream), so we can render {@link ThinkingStageCards} instead.
 */
export function isStageProgressMarkdown(content: string): boolean {
	const t = content.trim();
	if (!t || t.length > 8000) return false;

	const re = /^\s*[*•-]\s+(.+)$/gm;
	const items: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(t)) !== null) {
		items.push(m[1].toLowerCase());
	}
	if (items.length < 2) return false;

	const blob = items.join(' | ');
	const hasBootstrap = blob.includes('bootstrap');
	const hasBlueprint = blob.includes('blueprint');
	const hasCodeGen =
		blob.includes('generating code') ||
		(blob.includes('code') && blob.includes('generat'));

	return (
		(hasBootstrap && hasBlueprint) ||
		(hasBootstrap && hasCodeGen) ||
		(hasBlueprint && hasCodeGen)
	);
}
