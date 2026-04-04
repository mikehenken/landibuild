import React from 'react';
import { Outlet, useLocation } from 'react-router';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { CollapsedSidebarTrigger } from './collapsed-sidebar-trigger';
import { AppsDataProvider } from '@/contexts/apps-data-context';
import clsx from 'clsx';

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { pathname } = useLocation();
  return (
    <AppsDataProvider>
      <SidebarProvider 
        defaultOpen={false}
        style={{
          "--sidebar-width": "240px",
          "--sidebar-width-mobile": "280px",
          "--sidebar-width-icon": "52px"
        } as React.CSSProperties}
      >
        <AppSidebar />
        <CollapsedSidebarTrigger />
        <SidebarInset className={clsx("bg-[#121212] flex flex-col h-screen relative", pathname !== "/" && "overflow-hidden")}>
          <div className={clsx("flex-1 bg-[#121212]", pathname !== "/" && "min-h-0 overflow-auto")}>
            {children || <Outlet />}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppsDataProvider>
  );
}