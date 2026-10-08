"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function ActionButton({ children, pendingText, confirm, variant = "default", disabled = false }: { children: React.ReactNode; pendingText: string; confirm?: string; variant?: "default" | "outline" | "destructive"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;
  return <Button type="submit" variant={variant} disabled={isDisabled} aria-busy={pending} onClick={event => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }}>{pending ? pendingText : children}</Button>;
}
