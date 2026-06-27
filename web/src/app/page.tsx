"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data";

export default function Home() {
  const router = useRouter();
  const { session, sessionLoaded } = useAppData();

  useEffect(() => {
    if (!sessionLoaded) return;
    router.replace(session ? "/chat" : "/login");
  }, [sessionLoaded, session, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
