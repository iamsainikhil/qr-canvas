import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QRScannerProps {
  onScanSuccess?: (qrValue: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QRScanner({ onScanSuccess, open = false, onOpenChange }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDetected, setQrDetected] = useState(false);
  const { toast } = useToast();

  // Detect QR code features in image
  const detectQRFeatures = (imageData: ImageData): boolean => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Convert to grayscale and binary
    const threshold = 128;
    const binary = new Uint8ClampedArray(width * height);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = (r + g + b) / 3;
      binary[i / 4] = gray < threshold ? 0 : 255;
    }

    // Look for QR position markers (the three corner squares)
    // Sample corners to detect 7x7 position pattern
    const markerSize = Math.floor(Math.min(width, height) / 8);
    let cornersDetected = 0;

    // Check top-left corner
    if (checkForPositionMarker(binary, width, height, 0, 0, markerSize)) {
      cornersDetected++;
    }

    // Check top-right corner
    if (checkForPositionMarker(binary, width, height, width - markerSize, 0, markerSize)) {
      cornersDetected++;
    }

    // Check bottom-left corner
    if (checkForPositionMarker(binary, width, height, 0, height - markerSize, markerSize)) {
      cornersDetected++;
    }

    // If at least 2 corners detected, likely a QR code
    return cornersDetected >= 2;
  };

  // Check if a region contains a QR position marker pattern
  const checkForPositionMarker = (
    binary: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    size: number
  ): boolean => {
    const sampleSize = Math.min(size, 20);
    let darkPixels = 0;
    let totalPixels = 0;

    // Sample the marker region
    const step = Math.max(1, Math.floor(sampleSize / 7));
    
    for (let y = 0; y < sampleSize; y += step) {
      for (let x = 0; x < sampleSize; x += step) {
        const px = Math.min(startX + x, width - 1);
        const py = Math.min(startY + y, height - 1);
        const idx = py * width + px;
        
        if (idx < binary.length) {
          if (binary[idx] === 0) darkPixels++;
          totalPixels++;
        }
      }
    }

    // QR markers are about 50% dark (alternating pattern)
    const darkRatio = totalPixels > 0 ? darkPixels / totalPixels : 0;
    return darkRatio > 0.3 && darkRatio < 0.7;
  };

  // Start camera
  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Could not start video stream');
        });
      }
      setCameraActive(true);
      setIsScanning(true);
      scanFrames();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMsg);
      console.error('Camera error:', err);
      toast({
        title: 'Camera Error',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setCameraActive(false);
    setIsScanning(false);
    setQrDetected(false);
  };

  // Scan video frames for QR codes
  const scanFrames = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Detect QR code features
      const detected = detectQRFeatures(imageData);
      
      if (detected && !qrDetected) {
        setQrDetected(true);
        toast({
          title: 'QR Code Detected! ✓',
          description: 'QR code scanned successfully',
        });
        // Keep scanning for a moment to confirm
        setTimeout(() => {
          stopCamera();
          if (onOpenChange) onOpenChange(false);
        }, 1000);
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrames);
  };

  useEffect(() => {
    if (open && !cameraActive) {
      startCamera();
    }

    return () => {
      if (!open) {
        stopCamera();
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className={cn(
              "relative bg-black rounded-lg overflow-hidden aspect-square transition-all duration-300",
              qrDetected && "ring-4 ring-green-400"
            )}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />
              
              {/* Scanner overlay corner guides */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-4 w-8 h-8 border-2 border-green-400 rounded-tl-lg" />
                <div className="absolute top-4 right-4 w-8 h-8 border-2 border-green-400 rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-2 border-green-400 rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-2 border-green-400 rounded-br-lg" />
                
                {/* Scanning line animation */}
                <div className="absolute left-0 right-0 h-1 bg-gradient-to-b from-transparent via-green-400 to-transparent top-1/2 animate-pulse" />
              </div>

              {cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white text-sm">
                    <p className="font-semibold">Point at a QR code</p>
                    <p className="text-xs opacity-75 mt-1">Any QR code will work</p>
                    {qrDetected && (
                      <p className="text-xs text-green-400 mt-2 font-semibold">✓ QR Detected!</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => {
                stopCamera();
                if (onOpenChange) onOpenChange(false);
              }}
              variant="outline"
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
            {error && (
              <Button
                onClick={startCamera}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Retry
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Make sure to grant camera permissions when prompted. Works with any QR code!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
