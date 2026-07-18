import { Heart, QrCode } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-secondary/30 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <QrCode className="w-4 h-4" />
            <span className="text-sm">QR Canvas — Free, self-hosted dynamic QR codes with scan analytics</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            Made with <Heart className="w-3.5 h-3.5 text-destructive fill-destructive mx-1" /> for the web
          </div>
        </div>
      </div>
    </footer>
  );
}
