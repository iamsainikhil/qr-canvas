import { QrCode, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="QR Canvas" className="w-14 h-14 rounded-lg" />
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">QR Canvas</h1>
            <p className="text-sm text-muted-foreground">Unlimited dynamic QR codes with scan tracking — free, open-source, self-hosted</p>
          </div>
        </Link>

        <nav className="flex items-center gap-6">
          <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            Analytics
          </span>
          <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            Dashboard
          </span>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-foreground hover:text-accent transition-colors cursor-pointer">
            Free & open source
          </span>
        </nav>
      </div>
    </header>
  );
}
