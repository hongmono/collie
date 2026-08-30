import { useState, type ReactNode } from "react";
import { Check, ChevronDown, LayoutGrid, MoreHorizontal, Plus } from "lucide-react";

import { TabActionsSheet } from "@/components/tab-actions-sheet";
import { StatusDot } from "@/components/status-badge";
import { BottomSheet } from "@/components/ui/sheet";
import { worstTriage, TRIAGE_STATUS } from "@/lib/triage";
import { STATUS_LABEL, type AgentView, type TabView } from "@/lib/types";

interface MobileTabSwitcherProps {
  workspaceId: string;
  workspaceLabel: string;
  tabs: TabView[];
  agents: AgentView[];
  selected: string;
  trigger: ReactNode;
  onSelect: (tabId: string) => void;
  onOpenSpace: () => void;
  onNewTab: (workspaceId: string) => void;
  session?: string;
  readOnly?: boolean;
  onRenamed: () => void;
  onClosed: (tabId: string) => void;
}

// On a phone the pane title already names the current tab, so a second full-width tab strip repeats
// the same information and steals a terminal row. The title becomes the switcher trigger instead;
// its sheet retains every route the old strip exposed, while the adjacent + keeps creation one tap
// away. Desktop still renders TabStrip because it has room for direct horizontal switching.
export function MobileTabSwitcher({
  workspaceId,
  workspaceLabel,
  tabs,
  agents,
  selected,
  trigger,
  onSelect,
  onOpenSpace,
  onNewTab,
  session,
  readOnly,
  onRenamed,
  onClosed,
}: MobileTabSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [actionsTab, setActionsTab] = useState<TabView | null>(null);
  const workspaceTabs = tabs.filter((tab) => tab.workspaceId === workspaceId);

  function choose(tabId: string) {
    setOpen(false);
    if (tabId !== selected) onSelect(tabId);
  }

  function openActions(tab: TabView) {
    setOpen(false);
    setActionsTab(tab);
  }

  return (
    <div className="flex min-w-0 flex-1 items-center md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Switch tab in ${workspaceLabel}`}
        aria-haspopup="dialog"
        className="-mx-1 flex min-w-0 flex-1 items-center gap-1 rounded-lg px-1 py-0.5 text-left transition-colors active:bg-muted/60"
      >
        <div className="flex min-w-0 flex-1 items-center">{trigger}</div>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      <button
        type="button"
        onClick={() => onNewTab(workspaceId)}
        aria-label={`New tab in ${workspaceLabel}`}
        className="ml-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-border text-muted-foreground transition-colors active:scale-95 active:bg-muted/60"
      >
        <Plus className="size-4" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={`${workspaceLabel} tabs`}>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenSpace();
            }}
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left transition-colors active:bg-muted"
          >
            <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">All panes</span>
          </button>

          <div className="my-1 border-t border-border/60" />

          {workspaceTabs.map((tab) => {
            const active = tab.tabId === selected;
            const triage = worstTriage(agents.filter((agent) => agent.tabId === tab.tabId));
            const status = triage ? TRIAGE_STATUS[triage] : null;
            return (
              <div
                key={tab.tabId}
                className="flex min-h-12 items-stretch rounded-xl transition-colors active:bg-muted"
              >
                <button
                  type="button"
                  onClick={() => choose(tab.tabId)}
                  aria-current={active ? "page" : undefined}
                  aria-label={status ? `${tab.label}, ${STATUS_LABEL[status]}` : tab.label}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 text-left"
                >
                  {status ? (
                    <>
                      <StatusDot status={status} className="size-2.5" />
                      <span className="sr-only">{STATUS_LABEL[status]}</span>
                    </>
                  ) : (
                    <span className="size-2.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{tab.label}</span>
                  {active && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => openActions(tab)}
                  aria-label={`Actions for tab ${tab.label}`}
                  className="grid w-11 shrink-0 place-items-center rounded-r-xl text-muted-foreground active:bg-muted"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </BottomSheet>

      <TabActionsSheet
        open={actionsTab !== null}
        onClose={() => setActionsTab(null)}
        tab={actionsTab}
        session={session}
        readOnly={readOnly}
        onRenamed={onRenamed}
        onClosed={onClosed}
      />
    </div>
  );
}
