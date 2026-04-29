// src/components/ui/sonner.tsx
"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-center"
      toastOptions={{
        style: {
          background: "rgb(24 24 27)",
          border: "1px solid rgb(39 39 42)",
          color: "rgb(244 244 245)",
        },
      }}
    />
  );
}
