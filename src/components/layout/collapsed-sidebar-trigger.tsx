import type { ReactElement } from 'react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/**
 * When the sidebar is fully closed (offcanvas / sheet closed), the in-sidebar
 * toggle is off-screen. Renders a top chrome row so the control stays in normal
 * layout flow and does not overlap page content (e.g. chat messages).
 */
export function CollapsedSidebarChrome(): ReactElement | null {
	const { open, openMobile, isMobile } = useSidebar();
	const collapsed = isMobile ? !openMobile : !open;
	if (!collapsed) {
		return null;
	}
	return (
		<div
			className={cn(
				'shrink-0 z-10 flex items-center gap-2 border-b border-border-primary/30 bg-[#121212] px-3 py-2',
			)}
		>
			<SidebarTrigger
				className={cn(
					'size-9 shrink-0',
					'bg-transparent text-text-tertiary hover:bg-white/10 hover:text-text-primary',
					'shadow-none border-0',
				)}
			/>
		</div>
	);
}
