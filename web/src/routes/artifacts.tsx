import { ArrowLeft, Download, ExternalLink, FileText } from "lucide-react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";

import { RouteHeader } from "@/components/app-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ArtifactsData } from "@/lib/loaders";
import { homePath, spacePath } from "@/lib/nav";
import { useScope } from "@/lib/session";
import type { ArtifactRecord } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

const localUrl = (artifact: ArtifactRecord, scope?: ReturnType<typeof useScope>) => {
  const params = new URLSearchParams();
  if (scope?.host) params.set("host", scope.host);
  if (scope?.session) params.set("session", scope.session);
  const query = params.toString();
  return `/api/artifacts/${encodeURIComponent(artifact.id)}/content${query ? `?${query}` : ""}`;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dateGroups(artifacts: ArtifactRecord[]): [string, ArtifactRecord[]][] {
  const groups = new Map<string, ArtifactRecord[]>();
  for (const artifact of artifacts) {
    const day = artifact.createdAt.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), artifact]);
  }
  return [...groups];
}

function Preview({ artifact, scope }: { artifact: ArtifactRecord; scope?: ReturnType<typeof useScope> }) {
  const url = localUrl(artifact, scope);
  if (artifact.mime.startsWith("image/")) {
    return <img src={url} alt="" className="h-36 w-full rounded-md bg-muted object-contain" />;
  }
  if (artifact.mime.startsWith("text/html")) {
    return <iframe src={url} title={artifact.title} sandbox="allow-scripts" scrolling="no" tabIndex={-1} className="pointer-events-none h-36 w-full overflow-hidden rounded-md border bg-white" />;
  }
  return (
    <div className="grid h-36 place-items-center rounded-md bg-muted text-muted-foreground">
      <FileText className="size-7" />
    </div>
  );
}

export function ArtifactsRoute() {
  // SAFETY: router.tsx pairs this route with artifactsLoader, whose only result is ArtifactsData.
  const data = useLoaderData() as ArtifactsData;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const scope = useScope();
  useLocale();
  const spaceId = params.get("space") ?? undefined;
  const groups = dateGroups(data.artifacts);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <RouteHeader
        override={
          <>
            <Button variant="ghost" size="icon" className="size-11" onClick={() => navigate(spaceId ? spacePath(spaceId, scope) : homePath(scope))} aria-label={t("settings.nav.back")}>
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">{t("artifacts.title")}</h1>
          </>
        }
      />
      <main className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3 sm:p-4">
        {data.error && <p className="text-sm text-destructive">{t("artifacts.loadError")}</p>}
        {!data.error && data.artifacts.length === 0 && (
          <Card className="gap-2 p-5">
            <p className="font-medium">{t("artifacts.empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("artifacts.empty.body")}</p>
          </Card>
        )}
        {groups.map(([day, artifacts]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-xs font-medium text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(`${day}T00:00:00`))}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {artifacts.map((artifact) => (
                <Card key={artifact.id} className="gap-2 p-3">
                  <Preview artifact={artifact} scope={scope} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">{artifact.title}</h3>
                    <p className="truncate text-[11px] text-muted-foreground">{artifact.filename} · {formatBytes(artifact.size)}</p>
                  </div>
                  <div className="flex gap-1">
                    <a className={buttonVariants({ variant: "outline", size: "sm" })} href={localUrl(artifact, scope)} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> {t("artifacts.open")}</a>
                    <a className={buttonVariants({ variant: "ghost", size: "sm" })} href={localUrl(artifact, scope)} download={artifact.filename}><Download className="size-3.5" /> {t("artifacts.download")}</a>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
