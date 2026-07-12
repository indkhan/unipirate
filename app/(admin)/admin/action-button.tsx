"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function ActionButton({ children, pendingText, confirm, variant = "default" }: { children: React.ReactNode; pendingText: string; confirm?: string; variant?: "default" | "outline" | "destructive" }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} onClick={event => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }}>{pending ? pendingText : children}</Button>;
}
