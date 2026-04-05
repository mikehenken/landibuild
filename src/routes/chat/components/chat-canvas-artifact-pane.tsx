import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeExternalLinks from 'rehype-external-links';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ChatCanvasArtifact = {
	title: string;
	body: string;
	kind: string;
};

interface ChatCanvasArtifactPaneProps {
	artifact: ChatCanvasArtifact;
	onDismiss: () => void;
}

export function ChatCanvasArtifactPane({ artifact, onDismiss }: ChatCanvasArtifactPaneProps) {
	return (
		<aside className="w-[min(100%,320px)] shrink-0 flex flex-col bg-bg-3 rounded-xl border border-border-primary shadow-md shadow-bg-2 overflow-hidden max-h-full ring-1 ring-white/[0.06]">
			<div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-primary">
				<h3 className="text-sm font-medium truncate text-text-primary">{artifact.title}</h3>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0"
					onClick={onDismiss}
					aria-label="Close artifact panel"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div className="flex-1 overflow-y-auto p-3 text-sm prose prose-sm prose-invert max-w-none">
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					rehypePlugins={[[rehypeExternalLinks, { target: '_blank' }]]}
				>
					{artifact.body}
				</ReactMarkdown>
			</div>
		</aside>
	);
}
