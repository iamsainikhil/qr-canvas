import Link from 'next/link';
import { Icon } from '@iconify/react';

const GITHUB_REPO = 'https://github.com/iamsainikhil/qr-canvas';

export function Footer() {
  return (
    <footer className="py-6">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-3 px-4 text-center text-xs text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
        <p>© {new Date().getFullYear()} Sai Nikhil</p>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Icon icon="lucide:layout-dashboard" className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Icon icon="line-md:github" height="1.6em" />
            <span>Repository</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
