import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Plus, ChevronDown, SquarePen, Trash2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ChatHeaderProps {
	/** Persisted app id for API (omit until app record exists). */
	appId?: string;
	title: string;
	canManage: boolean;
	attachmentCount: number;
	/** When false, empty-state paperclip stays disabled (e.g. chat input locked). */
	canUploadImages: boolean;
	onTitleSaved?: () => void;
	onDeleteClick: () => void;
	onOpenAttachments: () => void;
	onRequestImageUpload: () => void;
}

export function ChatHeader({
	appId,
	title,
	canManage,
	attachmentCount,
	canUploadImages,
	onTitleSaved,
	onDeleteClick,
	onOpenAttachments,
	onRequestImageUpload,
}: ChatHeaderProps) {
	const navigate = useNavigate();
	const [isEditing, setIsEditing] = useState(false);
	const [editTitle, setEditTitle] = useState(title);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEditTitle(title);
	}, [title]);

	useEffect(() => {
		if (!isEditing || !inputRef.current) return;
		inputRef.current.focus();
		const len = inputRef.current.value.length;
		inputRef.current.setSelectionRange(len, len);
	}, [isEditing]);

	const saveTitle = async () => {
		if (!appId || !canManage) {
			setIsEditing(false);
			setEditTitle(title);
			return;
		}

		const next = editTitle.trim();
		if (!next || next === title) {
			setIsEditing(false);
			setEditTitle(title);
			return;
		}

		try {
			const response = await apiClient.updateAppTitle(appId, next);
			if (response.success && response.data?.app) {
				toast.success('Chat title updated');
				onTitleSaved?.();
			} else {
				throw new Error(
					typeof response.error === 'object' && response.error && 'message' in response.error
						? String(response.error.message)
						: 'Failed to update title',
				);
			}
		} catch {
			toast.error('Failed to update title');
			setEditTitle(title);
		} finally {
			setIsEditing(false);
		}
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			void saveTitle();
		} else if (e.key === 'Escape') {
			setIsEditing(false);
			setEditTitle(title);
		}
	};

	const hasAttachments = attachmentCount > 0;
	const attachmentsUploadDisabled = !hasAttachments && !canUploadImages;

	const handleAttachmentsButtonClick = () => {
		if (hasAttachments) {
			onOpenAttachments();
			return;
		}
		if (canUploadImages) {
			onRequestImageUpload();
		}
	};

	return (
		<div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 w-full max-w-[780px] mx-auto">
			<div className="flex items-center gap-2 min-w-0 flex-1">
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9 shrink-0 text-text-tertiary hover:text-text-primary"
					onClick={() => navigate('/')}
					title="New chat"
					type="button"
				>
					<Plus className="h-5 w-5" strokeWidth={2} />
				</Button>

				<div className="min-w-0 flex-1 flex items-center gap-1">
					{isEditing ? (
						<input
							ref={inputRef}
							value={editTitle}
							onChange={(e) => setEditTitle(e.target.value)}
							onBlur={() => void saveTitle()}
							onKeyDown={onKeyDown}
							className="min-w-0 flex-1 bg-transparent border border-border-primary rounded-md px-2 py-1 text-base font-semibold text-text-primary outline-none focus:border-text-tertiary/40"
							placeholder="Chat title"
							aria-label="Edit chat title"
						/>
					) : canManage && appId ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="flex items-center gap-1 min-w-0 max-w-full rounded-md px-1 py-0.5 -ml-1 hover:bg-white/5 text-left"
								>
									<span className="truncate text-base font-semibold text-text-primary">
										{title || 'Untitled'}
									</span>
									<ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="start"
								sideOffset={6}
								className={cn(
									'w-48 p-1 rounded-xl border border-white/10',
									'bg-[#232323] shadow-lg shadow-black/40',
								)}
							>
								<DropdownMenuItem
									className="rounded-lg gap-2 cursor-pointer focus:bg-white/10 text-text-primary"
									onSelect={(e) => {
										e.preventDefault();
										setIsEditing(true);
									}}
								>
									<SquarePen className="h-4 w-4 shrink-0" strokeWidth={1.75} />
									Edit Name
								</DropdownMenuItem>
								<DropdownMenuItem
									className="rounded-lg gap-2 cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
									onSelect={(e) => {
										e.preventDefault();
										onDeleteClick();
									}}
								>
									<Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<span className="truncate text-base font-semibold text-text-primary px-1">
							{title || 'Chat'}
						</span>
					)}
				</div>
			</div>

			<div className="flex items-center shrink-0">
				<Button
					variant="ghost"
					size="icon"
					type="button"
					disabled={attachmentsUploadDisabled}
					onClick={handleAttachmentsButtonClick}
					title={
						hasAttachments
							? 'Attachments'
							: canUploadImages
								? 'Add images'
								: 'Add images (unavailable)'
					}
					className={cn(
						'relative h-9 w-9',
						hasAttachments
							? 'text-text-tertiary hover:text-text-primary'
							: 'text-text-tertiary/45 hover:text-text-tertiary/70',
						attachmentsUploadDisabled && 'opacity-40 hover:text-text-tertiary/45',
					)}
				>
					<Paperclip className="h-5 w-5" strokeWidth={1.75} />
					{hasAttachments && (
						<span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white leading-none">
							{attachmentCount > 99 ? '99+' : attachmentCount}
						</span>
					)}
				</Button>
			</div>
		</div>
	);
}
