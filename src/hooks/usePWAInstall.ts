import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Computed once at module load — never changes
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  );
}

// Store prompt globally so Settings can trigger it anytime
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) {
      setIsInstalled(true);
      return;
    }

    if (IS_IOS) {
      setShowIOSInstructions(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      globalDeferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!globalDeferredPrompt) return false;

    await globalDeferredPrompt.prompt();
    const choice = await globalDeferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }

    globalDeferredPrompt = null;
    setIsInstallable(false);
    return choice.outcome === 'accepted';
  }, []);

  const dismiss = useCallback(() => {
    setIsInstallable(false);
    setShowIOSInstructions(false);
  }, []);

  return {
    isInstallable,
    isInstalled,
    showIOSInstructions,
    isIOS: IS_IOS,
    install,
    dismiss,
  };
}
