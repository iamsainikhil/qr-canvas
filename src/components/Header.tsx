import { QrCode, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-paper">
              <QrCode className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-highlight flex items-center justify-center">
              <Sparkles className="w-2 h-2 text-highlight-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold text-foreground tracking-tight">
              QR Canvas
            </h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Unlimited dynamic QR codes — free & self-hosted</p>
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
