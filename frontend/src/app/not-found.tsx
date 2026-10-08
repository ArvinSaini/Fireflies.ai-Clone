import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
      <LogoMark className="size-10" />
      <h1 className="mt-2 text-[22px] font-medium text-ink">Page not found</h1>
      <p className="text-[14px] text-ink-4">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
      <Link href="/" className="mt-3 rounded-lg bg-brand px-4 py-2 text-[14px] font-medium text-white hover:bg-brand-hover">Go home</Link>
    </div>
  );
}
