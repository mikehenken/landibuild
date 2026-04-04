import type { ReactElement } from 'react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/**
 * When the sidebar is fully closed (offcanvas / sheet closed), the in-sidebar
 * toggle is off-screen. This renders only the small top-left control from the design.
 */
export function CollapsedSidebarTrigger(): ReactElement | null {
	const { open, openMobile, isMobile } = useSidebar();
	const collapsed = isMobile ? !openMobile : !open;
	if (!collapsed) {
		return null;
	}
	return (
		<SidebarTrigger
			className={cn(
				'fixed left-3 top-3 z-[60] size-9 shrink-0',
				'bg-transparent text-text-tertiary hover:bg-white/10 hover:text-text-primary',
				'shadow-none border-0',
			)}
		/>
	);
}
