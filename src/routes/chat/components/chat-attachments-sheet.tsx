import type { ChatAttachmentImage } from '../types/chat-attachment-image';
import { chatAttachmentImageSrc } from '../types/chat-attachment-image';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from '@/components/ui/sheet';
import { ImageIcon } from 'lucide-react';

export interface ChatAttachmentsSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** All images attached to this chat (composer, session URL, user message history). */
	chatImages: ChatAttachmentImage[];
	screenshotUrl?: string | null;
}

export function ChatAttachmentsSheet({
	open,
	onOpenChange,
	chatImages,
	screenshotUrl,
}: ChatAttachmentsSheetProps) {
	const images = chatImages;
	const hasImages = images.length > 0;
	const hasScreenshot = Boolean(screenshotUrl?.trim());
	const isEmpty = !hasImages && !hasScreenshot;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full sm:max-w-md border-border-primary bg-bg-2 flex flex-col gap-0 p-0"
			>
				<SheetHeader className="px-5 pt-6 pb-2 shrink-0 text-left border-b border-border-primary/60">
					<SheetTitle className="text-text-primary">Attachments</SheetTitle>
					<SheetDescription className="text-text-tertiary">
						Images and screenshots for this chat. Open the file tree in the preview to browse project files.
					</SheetDescription>
				</SheetHeader>
				<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
					<div className="flex flex-col gap-8">
						{hasImages && (
							<section>
								<h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
									<ImageIcon className="size-4 shrink-0" />
									Images ({images.length})
								</h3>
								<ul className="grid grid-cols-2 gap-3">
									{images.map((img) => (
										<li
											key={img.id}
											className="rounded-lg overflow-hidden border border-border-primary bg-[#292929] min-w-0"
										>
											<img
												src={chatAttachmentImageSrc(img)}
												alt={img.filename}
												className="w-full h-32 object-cover"
											/>
											<p
												className="text-xs text-text-tertiary px-2 py-1.5 truncate"
												title={img.filename}
											>
												{img.filename}
											</p>
										</li>
									))}
								</ul>
							</section>
						)}

						{hasScreenshot && screenshotUrl && (
							<section>
								<h3 className="text-sm font-medium text-text-secondary mb-3">Preview screenshot</h3>
								<div className="rounded-lg overflow-hidden border border-border-primary bg-[#292929]">
									<img
										src={screenshotUrl}
										alt="App preview"
										className="w-full max-h-48 object-contain bg-bg-3"
									/>
								</div>
							</section>
						)}

						{isEmpty && (
							<p className="text-sm text-text-tertiary">No images or screenshots yet.</p>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
