import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { MobileTabSwitcher } from "./mobile-tab-switcher";
import type { AgentView, TabView } from "@/lib/types";

const tabs: TabView[] = [
  { tabId: "w1:t1", workspaceId: "w1", number: 1, label: "build", focused: true, paneCount: 1 },
  { tabId: "w1:t2", workspaceId: "w1", number: 2, label: "review", focused: false, paneCount: 2 },
  { tabId: "w2:t1", workspaceId: "w2", number: 1, label: "other", focused: false, paneCount: 1 },
];

const agents: AgentView[] = [
  {
    paneId: "w1:t2:p1",
    workspaceId: "w1",
    workspaceLabel: "collie",
    workspaceNumber: 1,
    tabId: "w1:t2",
    agent: "codex",
    status: "working",
    cwd: "/repo",
    focused: false,
  },
];

function setup(overrides: Partial<ComponentProps<typeof MobileTabSwitcher>> = {}) {
  const props: ComponentProps<typeof MobileTabSwitcher> = {
    workspaceId: "w1",
    workspaceLabel: "collie",
    tabs,
    agents,
    selected: "w1:t1",
    trigger: <span>collie › build</span>,
    onSelect: vi.fn(),
    onOpenSpace: vi.fn(),
    onNewTab: vi.fn(),
    onRenamed: vi.fn(),
    onClosed: vi.fn(),
    ...overrides,
  };
  render(<MobileTabSwitcher {...props} />);
  return props;
}

describe("MobileTabSwitcher", () => {
  it("puts tab switching behind the header title and lists only this workspace", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole("button", { name: "Switch tab in collie" }));
    expect(screen.getByRole("dialog", { name: "collie tabs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "build" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "review, working" })).toHaveTextContent("working");
    expect(screen.queryByText("other")).toBeNull();

    await user.click(screen.getByRole("button", { name: "review, working" }));
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith("w1:t2");
    expect(screen.queryByRole("dialog", { name: "collie tabs" })).toBeNull();
  });

  it("keeps space overview and new-tab actions in the integrated header", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole("button", { name: "New tab in collie" }));
    expect(props.onNewTab).toHaveBeenCalledExactlyOnceWith("w1");

    await user.click(screen.getByRole("button", { name: "Switch tab in collie" }));
    await user.click(screen.getByRole("button", { name: "All panes" }));
    expect(props.onOpenSpace).toHaveBeenCalledOnce();
  });

  it("opens the existing rename and close actions from a tab row", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Switch tab in collie" }));
    await user.click(screen.getByRole("button", { name: "Actions for tab review" }));
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close tab" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "collie tabs" })).toBeNull();
  });
});
