import type { ConversationMessage } from '@/api-types';
import { isSupportedImageType } from '@/api-types';
import type { ChatAttachmentImage } from '../types/chat-attachment-image';

/**
 * Pull image parts from persisted agent conversation content (multimodal user messages).
 */
export function extractImagesFromConversationContent(
	content: ConversationMessage['content'],
	conversationId: string,
): ChatAttachmentImage[] {
	if (!content || typeof content === 'string') return [];
	if (!Array.isArray(content)) return [];

	const out: ChatAttachmentImage[] = [];
	let imageIndex = 0;

	for (const part of content) {
		if (!part || typeof part !== 'object' || !('type' in part)) continue;
		if (part.type !== 'image_url') continue;

		const url = part.image_url?.url;
		if (!url || typeof url !== 'string') continue;

		const id = `hist-${conversationId}-${imageIndex}`;

		if (url.startsWith('data:')) {
			const match = /^data:([^;]+);base64,(.+)$/.exec(url);
			if (match) {
				const mime = match[1];
				const base64Data = match[2];
				if (isSupportedImageType(mime)) {
					out.push({
						id,
						filename: 'image',
						mimeType: mime,
						base64Data,
					});
				}
			}
			imageIndex += 1;
			continue;
		}

		if (url.startsWith('http://') || url.startsWith('https://')) {
			out.push({
				id,
				filename: 'Image',
				remoteUrl: url,
			});
			imageIndex += 1;
		}
	}

	return out;
}
