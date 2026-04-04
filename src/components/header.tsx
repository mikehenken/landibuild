import React from 'react';
import clsx from 'clsx';
import { Link } from 'react-router';

export function Header({
	className,
	children,
}: React.ComponentProps<'header'>) {
	return (
		<header
			className={clsx(
				'h-13 shrink-0 w-full px-4 border-b flex items-center',
				className,
			)}
		>
			<h1 className="flex items-center gap-2 mx-4">
				<Link to="/" className="flex items-center">
					<img
						src="/logobuild.png"
						alt="LANDiBUILD"
						className="h-8 w-auto max-w-[140px] object-contain object-left dark:brightness-110"
						width={140}
						height={32}
					/>
				</Link>
			</h1>
			<div className="flex-1"></div>
			<div className="flex items-center gap-4">
				{children}
			</div>
		</header>
	);
}
