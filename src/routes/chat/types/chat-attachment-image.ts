import type { ImageAttachment } from '@/api-types';

/** Images the user added to the chat: composer uploads, URL-session images, or restored multimodal history. */
export type ChatAttachmentImage =
	| ImageAttachment
	| {
			id: string;
			filename: string;
			remoteUrl: string;
	  };

export function isRemoteChatImage(
	img: ChatAttachmentImage,
): img is Extract<ChatAttachmentImage, { remoteUrl: string }> {
	return 'remoteUrl' in img && typeof img.remoteUrl === 'string';
}

export function chatAttachmentImageSrc(img: ChatAttachmentImage): string {
	if (isRemoteChatImage(img)) {
		return img.remoteUrl;
	}
	return `data:${img.mimeType};base64,${img.base64Data}`;
}
