"use client";

import type { ReactNode } from "react";
import { openAssistant } from "./assistant/AssistantWidget";

/** Opens e-Taxi with a prefilled question. */
export function AskButton({ message, children, className = "" }: { message: string; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => openAssistant(message)} className={className}>
      {children}
    </button>
  );
}
