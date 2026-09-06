"use client";
import { useEffect, useState } from "react";
import { fetchBackendHealth, ORCA_API_URL, type HealthResponse } from "@/lib/orca-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Phase 1 verification page — not linked in the main nav yet.
// Visit /system-status directly to confirm the Next.js frontend can reach
// the FastAPI backend. This will evolve into a real system-status view
// (agent health, data source status, etc.) in a later phase.
export default function SystemStatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBackendHealth()
      .then(setHealth)
      .catch((e) => setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[640px] mx-auto">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Backend Connection Status</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Phase 1 check — confirms Next.js can reach the FastAPI backend at{" "}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">{ORCA_API_URL}</code>.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">GET /health</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">Checking backend…</div>}

          {!loading && error && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-destructive">Could not reach the backend</div>
              <div className="text-xs text-muted-foreground">{error}</div>
              <div className="text-xs text-muted-foreground">
                Make sure the FastAPI server is running (see backend/README setup commands) and that
                NEXT_PUBLIC_ORCA_API_URL in .env.local points at it.
              </div>
            </div>
          )}

          {!loading && health && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/20">
                  {health.status.toUpperCase()}
                </Badge>
                <span className="font-medium">{health.service}</span>
              </div>
              <div className="text-xs text-muted-foreground">Environment: {health.environment}</div>
              <div className="text-xs text-muted-foreground">Server time: {health.time}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
