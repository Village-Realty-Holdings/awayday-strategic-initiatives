"use client";

import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn Sonner wrapper, light-only (the app has no dark mode, so no
// next-themes). Colors come from the Awayday tokens through Sonner's CSS
// variables. Sonner injects its own unlayered stylesheet, which beats Tailwind's
// layered utilities, so the error accent uses the `!` important modifier.
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      closeButton
      className="toaster group"
      icons={{
        success: <CircleCheck size={16} className="text-ok" aria-hidden />,
        error: <CircleAlert size={16} className="text-risk" aria-hidden />,
        info: <Info size={16} className="text-navy" aria-hidden />,
      }}
      toastOptions={{
        classNames: {
          toast: "text-sm",
          error: "border-risk/40!",
        },
      }}
      style={
        {
          "--normal-bg": "var(--color-surface)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
