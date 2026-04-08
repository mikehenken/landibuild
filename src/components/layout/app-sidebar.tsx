import React, { useCallback, useEffect } from 'react';
import {
	Settings,
	Plus,
	Search,
	Globe,
	Lock,
	Users2,
	Bookmark,
	PanelLeftClose,
	PanelLeftOpen,
	FileText,
	MonitorPlay,
	TerminalSquare,
	Clock,
} from 'lucide-react';
import './sidebar-overrides.css';
import { useRecentApps } from '@/hooks/use-apps';
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarMenuAction,
	SidebarSeparator,
	SidebarFooter,
	SidebarHeader,
	useSidebar,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isValid } from 'date-fns';
import { AppActionsDropdown } from '@/components/shared/AppActionsDropdown';

import { ThemeToggle } from '../theme-toggle';
import { AuthButton } from '../auth/auth-button';

interface App {
	id: string;
	title: string;
	framework?: string | null;
	updatedAt: Date | null;
	updatedAtFormatted?: string;
	visibility: 'private' | 'team' | 'board' | 'public';
	isFavorite?: boolean;
}

// Reusable AppMenuItem component for consistent app display
interface AppMenuItemProps {
	app: App;
	onClick: (id: string) => void;
	variant?: 'recent' | 'bookmarked';
	showActions?: boolean;
	isCollapsed: boolean;
	getVisibilityIcon: (visibility: App['visibility']) => React.ReactNode;
}

function AppMenuItem({
	app,
	onClick,
	variant = 'recent',
	showActions = true,
	isCollapsed,
	getVisibilityIcon,
}: AppMenuItemProps) {
	const formatTimestamp = () => {
		if (app.updatedAtFormatted) return app.updatedAtFormatted;
		if (app.updatedAt && isValid(app.updatedAt)) {
			return formatDistanceToNow(app.updatedAt, { addSuffix: true });
		}
		return 'Recently';
	};

	return (
		<SidebarMenuItem className="group/app-item">
			<SidebarMenuButton
				asChild
				tooltip={app.title}
				className="cursor-pointer transition-opacity hover:opacity-75 pr-0"
			>
				<a
					href={`/app/${app.id}`}
					onClick={(e) => {
						e.preventDefault();
						onClick(app.id);
					}}
					className="w-full no-underline"
				>
					<div className="flex-1 min-w-0 pr-2">
						<div className="flex items-center gap-2 min-w-0">
							{variant === 'bookmarked' && (
								<Bookmark className="h-3 w-3 fill-yellow-500 text-yellow-500 flex-shrink-0" />
							)}

							<div className="relative flex-1 min-w-0 overflow-hidden">
								<span className="font-medium flex justify-start items-center gap-2 text-text-primary/80 whitespace-nowrap">
									<span className="text-ellipsis w-fit overflow-hidden text-[calc(1em+0.15em)]">
										{app.title}{' '}
									</span>
									<div className="flex-shrink-0 min-w-6">
										{getVisibilityIcon(app.visibility)}
									</div>
								</span>

								<div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-bg-2 to-transparent pointer-events-none" />
							</div>
						</div>
						<p className="text-xs text-text-tertiary truncate">
							{formatTimestamp()}
						</p>
					</div>
				</a>
			</SidebarMenuButton>

			{!isCollapsed && showActions && (
				<SidebarMenuAction
					asChild
					className="opacity-0 -mr-2 group-hover/app-item:opacity-100 transition-opacity"
				>
					<AppActionsDropdown
						appId={app.id}
						appTitle={app.title}
						size="sm"
						className="h-6 w-6"
						showOnHover={false}
					/>
				</SidebarMenuAction>
			)}
		</SidebarMenuItem>
	);
}

export function AppSidebar() {
	const { user } = useAuth();
	const isLoggedIn = Boolean(user);
	const navigate = useNavigate();
	const { state, openMobile, isMobile, toggleSidebar } = useSidebar();

	const goToNewChat = useCallback(() => {
		navigate('/');
	}, [navigate]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key !== 'k' && e.key !== 'K') return;
			if (!e.ctrlKey && !e.metaKey) return;
			if (e.altKey || e.shiftKey) return;
			e.preventDefault();
			goToNewChat();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [goToNewChat]);
	// Mobile uses Sheet + openMobile; desktop uses open via state (offcanvas hides panel when "collapsed").
	const isCollapsed = isMobile ? !openMobile : state === 'collapsed';

	// Fetch real data from API
	const { apps: recentApps } = useRecentApps();

	const getVisibilityIcon = (visibility: App['visibility']) => {
		switch (visibility) {
			case 'private':
				return <Lock className="h-3 w-3" />;
			case 'team':
				return <Users2 className="h-3 w-3" />;
			case 'board':
				return <Globe className="h-3 w-3" />;
			case 'public':
				return <Globe className="h-3 w-3" />;
		}
	};

	return (
		<Sidebar
			collapsible="offcanvas"
			className={cn('bg-[#161817] transition-all duration-300 ease-in-out')}
		>
			<SidebarHeader className={cn("flex items-center p-4 relative", isCollapsed ? "justify-center" : "flex-row justify-center")}>
				{!isCollapsed && (
					<button
						type="button"
						onClick={() => navigate('/')}
						className="rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 flex items-center justify-center"
						aria-label="LANDiBUILD home"
					>
						<img src="/logo-red.png" alt="LANDI" className="h-8" />
					</button>
				)}
				<button
					onClick={toggleSidebar}
					className={cn(
						"p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-[#2a2a2a] transition-colors",
						isCollapsed ? "mt-2" : "absolute right-4"
					)}
				>
					{isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
				</button>
			</SidebarHeader>

			<SidebarContent className="text-[calc(1em+0.15em)]">
				<div className={cn("mb-4", isCollapsed ? "px-2" : "px-3")}>
					<button
						type="button"
						className={cn(
							'flex items-center justify-between font-medium hover:opacity-90 transition-opacity rounded-xl text-text-primary bg-[#2a2a2a] border border-[#3a3a3a]',
							isCollapsed ? 'w-10 h-10 mx-auto p-0 justify-center' : 'w-full px-3 py-2.5'
						)}
						onClick={goToNewChat}
					>
						<div className="flex items-center gap-2">
							<Plus className={cn("h-4 w-4", !isCollapsed && "text-text-primary")} />
							{!isCollapsed && (
								<span className="text-[calc((1em+0.15em)*0.85)] font-medium">New Chat</span>
							)}
						</div>
						{!isCollapsed && (
							<div className="flex items-center gap-1 text-xs text-text-tertiary font-mono bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#3a3a3a]">
								<span>Ctrl</span>
								<span>K</span>
							</div>
						)}
					</button>
				</div>

				<ScrollArea className="flex-1 px-2">
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										onClick={() => navigate('/?focus=landing-pages&from=websites')}
										tooltip="Websites"
										className="group hover:bg-[#2a2a2a]"
									>
										<Globe className="h-4 w-4 text-text-tertiary group-hover:text-text-primary" />
										{!isCollapsed && <span className="text-[calc(1em+0.15em)]">Websites</span>}
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										onClick={() => window.open('https://docs.landi.build', '_blank')}
										tooltip="Docs"
										className="group hover:bg-[#2a2a2a]"
									>
										<FileText className="h-4 w-4 text-text-tertiary group-hover:text-text-primary" />
										{!isCollapsed && <span className="text-[calc(1em+0.15em)]">Docs</span>}
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										onClick={() => navigate('/?mode=presentation')}
										tooltip="Slides"
										className="group hover:bg-[#2a2a2a]"
									>
										<MonitorPlay className="h-4 w-4 text-text-tertiary group-hover:text-text-primary" />
										{!isCollapsed && <span className="text-[calc(1em+0.15em)]">Slides</span>}
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										type="button"
										disabled
										tooltip="Deep Research (coming soon)"
										aria-disabled="true"
										className="group flex items-center justify-between w-full opacity-45 cursor-not-allowed hover:bg-transparent"
									>
										<div className="flex items-center gap-2">
											<Search className="h-4 w-4 text-text-tertiary" />
											{!isCollapsed && <span className="text-[calc(1em+0.15em)]">Deep Research</span>}
										</div>
										{!isCollapsed && (
											<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#2a2a2a] text-text-tertiary border border-[#3a3a3a]">
												Soon
											</span>
										)}
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										onClick={() => navigate('/')}
										tooltip="Landi Code"
										className="group hover:bg-[#2a2a2a]"
									>
										<TerminalSquare className="h-4 w-4 text-text-tertiary group-hover:text-text-primary" />
										{!isCollapsed && <span className="text-[calc(1em+0.15em)]">Landi Code</span>}
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										type="button"
										disabled
										tooltip="Landi Claw (coming soon)"
										aria-disabled="true"
										className="group flex items-center justify-between w-full opacity-45 cursor-not-allowed hover:bg-transparent"
									>
										<div className="flex items-center gap-2">
											<TerminalSquare className="h-4 w-4 text-text-tertiary" />
											{!isCollapsed && <span className="text-[calc(1em+0.15em)]">Landi Claw</span>}
										</div>
										{!isCollapsed && (
											<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#2a2a2a] text-text-tertiary border border-[#3a3a3a]">
												Soon
											</span>
										)}
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarSeparator className="my-2 mx-4" />

					<SidebarGroup>
						<SidebarGroupLabel className="flex items-center gap-2 text-sm font-medium text-text-primary px-2 mb-2">
							<Clock className="h-4 w-4 text-text-tertiary" />
							{!isCollapsed && <span className="text-[calc(1em+0.15em)]">Chat History</span>}
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{isLoggedIn ? (
									recentApps.map((app) => (
										<AppMenuItem
											key={app.id}
											app={app}
											onClick={(id) => navigate(`/app/${id}`)}
											variant="recent"
											showActions={true}
											isCollapsed={isCollapsed}
											getVisibilityIcon={getVisibilityIcon}
										/>
									))
								) : (
									!isCollapsed && (
										<SidebarMenuItem>
											<p className="px-2 py-1 text-xs text-text-tertiary">
												Sign in to see chat history.
											</p>
										</SidebarMenuItem>
									)
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</ScrollArea>
			</SidebarContent>

			<SidebarFooter className="p-3">
				<SidebarMenu>
					<SidebarMenuItem className="flex items-center gap-2 mb-2 px-2">
						<ThemeToggle />
						{isLoggedIn ? (
							<button
								type="button"
								onClick={() => navigate('/settings')}
								className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-[#2a2a2a] transition-colors"
								aria-label="Settings"
							>
								<Settings className="h-5 w-5" />
							</button>
						) : null}
					</SidebarMenuItem>
					<SidebarMenuItem className="flex w-full flex-col gap-2">
						{!isCollapsed && !isLoggedIn ? (
							<AuthButton className="w-full justify-center" />
						) : (
							<AuthButton variant="sidebar" isCollapsed={isCollapsed} />
						)}
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
