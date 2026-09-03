import { ArrowLeft, Download, ExternalLink, FileText } from "lucide-react";
import { useLoaderData, useNavigate } from "react-router";

import { RouteHeader } from "@/components/app-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ArtifactsData } from "@/lib/loaders";
import { homePath } from "@/lib/nav";
import { useScope } from "@/lib/session";
import type { ArtifactRecord } from "@/lib/types";

const localUrl = (artifact: ArtifactRecord) => `/api/artifacts/${encodeURIComponent(artifact.id)}/content`;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Preview({ artifact }: { artifact: ArtifactRecord }) {
  const url = localUrl(artifact);
  if (artifact.mime.startsWith("image/")) {
    return <img src={url} alt="" className="max-h-64 w-full rounded-lg bg-muted object-contain" />;
  }
  if (artifact.mime.startsWith("text/html")) {
    return <iframe src={url} title={artifact.title} sandbox="allow-scripts" className="h-64 w-full rounded-lg border bg-white" />;
  }
  return (
    <div className="grid h-28 place-items-center rounded-lg bg-muted text-muted-foreground">
      <FileText className="size-8" />
    </div>
  );
}

export function ArtifactsRoute() {
  // SAFETY: router.tsx pairs this route with artifactsLoader, whose only result is ArtifactsData.
  const data = useLoaderData() as ArtifactsData;
  const navigate = useNavigate();
  const scope = useScope();
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <RouteHeader
        override={
          <>
            <Button variant="ghost" size="icon" className="size-11" onClick={() => navigate(homePath(scope))} aria-label="Back">
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">Artifacts</h1>
          </>
        }
      />
      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {data.error && <p className="text-sm text-destructive">Couldn’t load artifacts.</p>}
        {!data.error && data.artifacts.length === 0 && (
          <Card className="gap-2 p-5">
            <p className="font-medium">No artifacts yet</p>
            <p className="text-sm text-muted-foreground">Agent-created previews, reports, images and downloads will appear here.</p>
          </Card>
        )}
        {data.artifacts.map((artifact) => (
          <Card key={artifact.id} className="gap-3 p-4">
            <Preview artifact={artifact} />
            <div className="min-w-0">
              <h2 className="truncate font-medium">{artifact.title}</h2>
              <p className="truncate text-xs text-muted-foreground">
                {artifact.filename} · {formatBytes(artifact.size)} · {artifact.status}
              </p>
            </div>
            <div className="flex gap-2">
              <a className={buttonVariants({ variant: "outline", size: "sm" })} href={localUrl(artifact)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open
              </a>
              <a className={buttonVariants({ variant: "ghost", size: "sm" })} href={localUrl(artifact)} download={artifact.filename}>
                <Download className="size-4" /> Download
              </a>
            </div>
          </Card>
        ))}
      </main>
    </div>
  );
}
