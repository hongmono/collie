import { useState } from "react";
import { useNavigate } from "react-router";

import { ArtifactsButton, RouteHeader, SettingsGear } from "@/components/app-header";
import { SessionSwitcher } from "@/components/session-switcher";
import { ServerSwitcher } from "@/components/server-switcher";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { AgentList } from "@/components/agent-list";
import { LaunchStrip } from "@/components/launch-strip";
import { SpaceOverview } from "@/components/space-overview";
import { NewSpaceSheet, type WorktreeRepo } from "@/components/new-space-sheet";
import { StatusArea } from "@/components/status-area";
import { ToastViewport } from "@/components/ui/toast-viewport";
import { BuildStamp } from "@/components/build-stamp";
import { PackFooterLink } from "@/components/pack-footer-link";
import { UpdateBanner } from "@/components/update-banner";
import { useDashPrefs, openForCount } from "@/hooks/use-dash-prefs";
import { useSpaceActions } from "@/hooks/use-spaces";
import { useMuxCapability } from "@/lib/mux-capability";
import { paneScope, sessionsOnHost } from "@/lib/hosts";
import { panePath, spacePath } from "@/lib/nav";
import type { AgentView, WorkspaceView } from "@/lib/types";
import { useRootData } from "@/lib/route-data";

// Dashboard home screen. The two live sections you might ACT on come first — Needs you → Working
// (see lib/triage.ts) — and the Spaces navigator sits last, under the thing it navigates to.
// Launchers sit directly above Spaces: they are one-tap act-on-able actions like the herd above
// them, but they CREATE rather than triage, so they sit under the triaged herd and above the
// navigator their new Space will appear in. Tapping an agent opens its pane; tapping a space
// drills into /space/:id; tapping a launcher creates a throwaway Space and types its command.
export function HomeRoute() {
  const data = useRootData();
  const navigate = useNavigate();
  const { newSpace, newWorktree, showWorktree, creatingSpace } = useSpaceActions();

  // Which repos a worktree could be branched from: one entry per repo, taken from the space that
  // shows the repo ITSELF (a worktree's own space would branch from the same repo, so listing both
  // would offer the same thing twice under two names). In the spaces list's order, so the first
  // entry — the sheet's default — is the repo most recently used.
  const canCreateWorktree = useMuxCapability("createWorktree");
  const worktreeRepos: WorktreeRepo[] = canCreateWorktree
    ? data.workspaces
        .filter((w) => w.repoRoot !== undefined && w.isWorktree === false)
        .map((w) => ({ workspaceId: w.workspaceId, repoRoot: w.repoRoot!, label: w.label }))
    : [];
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const { prefs, setSpacesOpen, setLaunchOpen } = useDashPrefs();
  // No stored choice yet? The space count decides — a two-space install shouldn't be handed a
  // mystery collapsed header, and a forty-space one shouldn't be handed a wall.
  const spacesOpen = openForCount(prefs.spacesOpen, data.workspaces.length);
  // The Launch section folds on the same terms. Its count comes from the component (it owns the
  // config read), so the un-chosen default is decided there against the same threshold.
  const launchOpen = prefs.launchOpen;

  // A row is opened with the PANE's host, never the ambient one: the dashboard is one list across
  // every machine (hosts are a label, not a split), so the row you tapped may well live somewhere
  // other than where the URL currently points. Resolving it here is what stops a reply landing on the
  // right pane name on the wrong terminal. Solo: every pane is untagged, so this is `data.scope`.
  const open = (pane: AgentView) =>
    navigate(panePath(pane.paneId, paneScope(data.scope, pane, data.servers, data.sessions)));
  const drillInto = (workspace: WorkspaceView) =>
    navigate(spacePath(workspace.workspaceId, paneScope(data.scope, workspace, data.servers)));
  // Sessions are a per-host registry, so the session switcher only ever lists this host's.
  const sessionsHere = sessionsOnHost(data.sessions ?? [], data.scope, data.servers);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      {/* The dashboard header: wordmark + the session switcher (dashboard-only), then the shared pill
          and the Settings gear. The switcher self-hides on a single-session install. */}
      <RouteHeader
        wordmark
        rightLead={
          <>
            {/* Host first, then session — outer dimension first, and the two are deliberately
                different shapes (bordered server pill vs filled layers capsule) so a glance can tell
                "change machine" from "change session on this machine". Both self-hide. */}
            <ServerSwitcher servers={data.servers} scope={data.scope} agents={data.agents} />
            <SessionSwitcher sessions={sessionsHere} scope={data.scope} viewAll={data.viewAll} />
          </>
        }
        rightTrail={
          <>
            <ArtifactsButton scope={data.scope} />
            <SettingsGear scope={data.scope} />
          </>
        }
      />

      {/* Content region below the header: a viewport-clipped internal scroller. `relative` is
          load-bearing: it makes this scroller the containing block for its absolutely-positioned
          descendants. Tailwind's `sr-only` is `position: absolute`, so every status label in the
          list would otherwise escape this scroller's clip and grow the document's own scrollbar. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* A notice BELOW the header is content, not viewport chrome: it is an inset box on the
            page gutter, not a full-bleed strip. Full-bleed it ran its left edge 16px outside the
            list it sat on top of — two left edges stacked, the loudest misalignment on the page. */}
        <ReadOnlyBanner device={data.device} />

        <main className="flex-1">
          {/* One list, every section, in triage order. It used to be split in two so "Needs you"
              could be hoisted above the spaces overview; with Spaces last there is nothing to
              straddle. */}
          <AgentList
            agents={data.agents}
            bridge={data.bridge}
            onOpen={open}
            sections={["needs", "working"]}
            error={data.error}
            lastSeenAt={data.lastSeenAt}
          />
          <LaunchStrip open={launchOpen} onOpenChange={setLaunchOpen} scope={data.scope} />
          <SpaceOverview
            workspaces={data.allWorkspaces ?? data.workspaces}
            agents={data.agents}
            shellPanes={data.shellPanes}
            servers={data.servers}
            onOpen={drillInto}
            onNewSpace={() => setNewSpaceOpen(true)}
            creatingSpace={creatingSpace}
            open={spacesOpen}
            onOpenChange={setSpacesOpen}
          />
        </main>

        {/* The footer is the dashboard's meta zone, in widening order: the pack you're part of, an
            available update / needed restart, then the build stamp (which bundle you're running,
            with a stale-cache nudge). The pack line self-hides on a solo install. */}
        <PackFooterLink scope={data.scope} className="px-4 pt-3" />
        <UpdateBanner className="px-4 pt-3" />
        <BuildStamp className="px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)]" />
      </div>

      {/* Status overlay, anchored to the bottom of the viewport (no input here) — same slim line,
          floating so it never shifts the list. Stays outside the scroller so it never scrolls away.

          `dock="bottom"` because this screen has no composer for a toast to collide with; the pane
          screen docks its own to the top for the opposite reason. The positioning — the portal, the
          z-rung, the safe-area inset — belongs to ToastViewport and is stated there once, which is
          what stopped it being three hand-rolled copies of the same four utilities. DESIGN.md §1. */}
      <ToastViewport>
        <StatusArea />
      </ToastViewport>

      <NewSpaceSheet
        open={newSpaceOpen}
        onClose={() => setNewSpaceOpen(false)}
        onCreate={newSpace}
        repos={worktreeRepos}
        scope={data.scope}
        onOpenWorktree={(workspaceId, path) => void showWorktree(workspaceId, path)}
        onCreateWorktree={(workspaceId, branch) => void newWorktree(workspaceId, branch)}
      />
    </div>
  );
}
