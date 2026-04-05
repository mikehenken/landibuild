import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Loader2, Trash2 } from 'lucide-react';
import type { ModelConfigPresetSummary } from '@/api-types';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BUILT_IN_MODEL_CONFIG_PRESET_SUMMARY_FALLBACK } from '@/constants/built-in-model-config-presets-metadata';

function isBuiltInPresetSummary(p: ModelConfigPresetSummary): boolean {
	return p.isBuiltIn === true || p.id.startsWith('builtin:');
}

export function ModelConfigPresetsPanel({
	onPresetsChanged,
}: {
	onPresetsChanged: () => void;
}) {
	const [presets, setPresets] = useState<ModelConfigPresetSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [saveOpen, setSaveOpen] = useState(false);
	const [newName, setNewName] = useState('');
	const [newDescription, setNewDescription] = useState('');
	const [saving, setSaving] = useState(false);
	const [applyId, setApplyId] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { builtInPresets, userPresets } = useMemo(() => {
		const fromApiBuiltIn = presets.filter(isBuiltInPresetSummary);
		const builtIn =
			fromApiBuiltIn.length > 0
				? fromApiBuiltIn
				: [...BUILT_IN_MODEL_CONFIG_PRESET_SUMMARY_FALLBACK];
		const user = presets.filter((p) => !p.id.startsWith('builtin:'));
		return { builtInPresets: builtIn, userPresets: user };
	}, [presets]);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const res = await apiClient.listModelConfigPresets();
			if (res.success && res.data) {
				setPresets(res.data.presets);
			} else {
				toast.error(res.error?.message || 'Failed to load configuration presets');
			}
		} catch {
			toast.error('Failed to load configuration presets');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const resetSaveForm = () => {
		setNewName('');
		setNewDescription('');
	};

	const handleSaveFromCurrent = async () => {
		const name = newName.trim();
		if (!name) {
			toast.error('Enter a preset name');
			return;
		}
		setSaving(true);
		try {
			const res = await apiClient.createModelConfigPresetFromCurrent({
				name,
				description: newDescription.trim() || null,
			});
			if (res.success) {
				toast.success('Preset saved from your current overrides');
				resetSaveForm();
				setSaveOpen(false);
				await load();
			} else {
				toast.error(res.error?.message || 'Could not save preset');
			}
		} finally {
			setSaving(false);
		}
	};

	const handleApply = async (presetId: string) => {
		setApplyId(presetId);
		try {
			const res = await apiClient.applyModelConfigPreset(presetId);
			if (res.success && res.data) {
				toast.success(res.data.message);
				onPresetsChanged();
			} else {
				toast.error(res.error?.message || 'Could not apply preset');
			}
		} finally {
			setApplyId(null);
		}
	};

	const handleDelete = async (presetId: string) => {
		setDeleteId(presetId);
		try {
			const res = await apiClient.deleteModelConfigPreset(presetId);
			if (res.success) {
				toast.success('Preset removed');
				await load();
			} else {
				toast.error(res.error?.message || 'Could not delete preset');
			}
		} finally {
			setDeleteId(null);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 space-y-0.5">
					<h4 className="text-sm font-medium text-text-primary">Presets</h4>
					<p className="text-xs text-text-tertiary leading-relaxed">
						Starter bundles ship with the product; your saved presets are stored on your account.
					</p>
				</div>
				<Dialog
					open={saveOpen}
					onOpenChange={(open) => {
						setSaveOpen(open);
						if (!open) {
							resetSaveForm();
						}
					}}
				>
					<DialogTrigger asChild>
						<Button type="button" variant="outline" size="sm" className="shrink-0 gap-2 self-start sm:self-center">
							<BookmarkPlus className="h-4 w-4" aria-hidden />
							Save as preset…
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Save current overrides</DialogTitle>
							<DialogDescription>
								Saves only agents you have customized below (not platform defaults). Use the model
								tabs first, then save here.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-2">
							<div className="space-y-2">
								<Label htmlFor="preset-name">Name</Label>
								<Input
									id="preset-name"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder="e.g. Gemini-first"
									disabled={saving}
									autoFocus
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="preset-desc">Description (optional)</Label>
								<Input
									id="preset-desc"
									value={newDescription}
									onChange={(e) => setNewDescription(e.target.value)}
									placeholder="Short note"
									disabled={saving}
								/>
							</div>
						</div>
						<DialogFooter className="gap-2 sm:gap-0">
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setSaveOpen(false);
									resetSaveForm();
								}}
								disabled={saving}
							>
								Cancel
							</Button>
							<Button type="button" onClick={() => void handleSaveFromCurrent()} disabled={saving}>
								{saving ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin mr-2" />
										Saving…
									</>
								) : (
									'Save preset'
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			<div className="rounded-lg border border-border-primary overflow-hidden">
				{loading ? (
					<div className="flex items-center gap-2 p-3 text-sm text-text-tertiary">
						<Loader2 className="h-4 w-4 animate-spin shrink-0" />
						Loading presets…
					</div>
				) : (
					<>
						<div className="bg-bg-2/80 dark:bg-bg-3/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-tertiary border-b border-border-primary">
							Starter bundles
						</div>
						<div className="divide-y divide-border-primary">
							{builtInPresets.map((p) => (
								<div
									key={p.id}
									className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 sm:gap-3"
								>
									<div className="min-w-0 flex-1 space-y-1">
										<div className="flex flex-wrap items-center gap-2 min-w-0">
											<span className="font-medium text-sm truncate">{p.name}</span>
											<Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
												Built-in
											</Badge>
										</div>
										{p.description ? (
											<p className="text-xs text-text-tertiary leading-snug">{p.description}</p>
										) : null}
									</div>
									<div className="flex items-center gap-1.5 shrink-0">
										<Button
											type="button"
											size="sm"
											variant="secondary"
											disabled={applyId === p.id}
											onClick={() => void handleApply(p.id)}
										>
											{applyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
										</Button>
									</div>
								</div>
							))}
						</div>
						<div className="bg-bg-2/80 dark:bg-bg-3/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-tertiary border-t border-b border-border-primary">
							Your presets
						</div>
						{userPresets.length === 0 ? (
							<div className="p-3 text-sm text-text-tertiary leading-relaxed">
								No custom presets yet. Adjust models in{' '}
								<span className="font-medium text-text-secondary">Model configuration overrides</span>{' '}
								below, then <span className="font-medium text-text-secondary">Save as preset…</span>.
							</div>
						) : (
							<div className="divide-y divide-border-primary">
								{userPresets.map((p) => (
									<div
										key={p.id}
										className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:gap-3"
									>
										<div className="min-w-0 flex-1">
											<div className="font-medium text-sm truncate">{p.name}</div>
											<div className="text-xs text-text-tertiary">
												{p.agentActionCount} customized role{p.agentActionCount === 1 ? '' : 's'}
											</div>
										</div>
										<div className="flex items-center gap-1.5 shrink-0">
											<Button
												type="button"
												size="sm"
												variant="secondary"
												disabled={applyId === p.id}
												onClick={() => void handleApply(p.id)}
											>
												{applyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												className="text-destructive hover:text-destructive h-8 w-8 p-0"
												disabled={deleteId === p.id}
												onClick={() => void handleDelete(p.id)}
												aria-label={`Delete preset ${p.name}`}
											>
												{deleteId === p.id ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Trash2 className="h-4 w-4" />
												)}
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
