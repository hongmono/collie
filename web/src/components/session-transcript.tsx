import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import type { ChatMessageListHandle } from "@/components/ui/chat/chat-message-list";
import { TranscriptView } from "@/components/transcript-view";
import { fetchHistory } from "@/lib/api";
import { HISTORY_PAGE_SIZE } from "@/lib/loaders";
import { setStatus } from "@/lib/status";
import type { PaneHistoryResponse, TranscriptEntry } from "@/lib/types";

const INITIAL_RENDER = 60;
const RENDER_STEP = 120;
const GROW_THRESHOLD = 800;

interface SessionTranscriptProps {
  paneId: string;
  session?: string;
  agent?: string;
  enabled: boolean;
  listRef: RefObject<ChatMessageListHandle | null>;
}

/**
 * Persisted conversation turns rendered above the live terminal inside its existing scroll owner.
 *
 * The full first page stays in memory, while only the newest window reaches the DOM. Scrolling
 * upward reveals more and preserves the reader's anchor; exceptionally long logs page from disk
 * only after the in-memory window reaches its start.
 */
export function SessionTranscript({
  paneId,
  session,
  agent,
  enabled,
  listRef,
}: SessionTranscriptProps) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [fileTruncated, setFileTruncated] = useState(false);
  const [renderCount, setRenderCount] = useState(INITIAL_RENDER);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const pendingRestore = useRef(false);
  const generation = useRef(0);
  const pagingAbort = useRef<AbortController | null>(null);
  const pagingInFlight = useRef(false);

  useEffect(() => {
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    pagingAbort.current?.abort();
    pagingAbort.current = null;
    pagingInFlight.current = false;
    setEntries([]);
    setHasMore(false);
    setFileTruncated(false);
    setRenderCount(INITIAL_RENDER);
    setFailed(false);
    setLoading(false);
    if (!enabled) return;

    const controller = new AbortController();
    void fetchHistory(
      paneId,
      { limit: HISTORY_PAGE_SIZE },
      session,
      controller.signal,
    )
      .then((response: PaneHistoryResponse) => {
        if (generation.current !== currentGeneration) return;
        if (!response.available) {
          setFailed(true);
          return;
        }
        setEntries(response.entries);
        setHasMore(response.hasMore);
        setFileTruncated(response.fileTruncated);
      })
      .catch((error: unknown) => {
        if (generation.current !== currentGeneration) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => {
      controller.abort();
      pagingAbort.current?.abort();
    };
  }, [enabled, paneId, retry, session]);

  const shown = useMemo(
    () => (renderCount >= entries.length ? entries : entries.slice(entries.length - renderCount)),
    [entries, renderCount],
  );
  const allRendered = renderCount >= entries.length;

  const captureAnchor = useCallback(() => {
    const element = listRef.current?.getScrollElement();
    anchor.current = element
      ? { height: element.scrollHeight, top: element.scrollTop }
      : null;
    pendingRestore.current = true;
  }, [listRef]);

  const loadOlder = useCallback(async () => {
    const oldest = entries[0]?.uuid;
    if (pagingInFlight.current || !hasMore || !oldest) return;
    const currentGeneration = generation.current;
    const controller = new AbortController();
    pagingInFlight.current = true;
    pagingAbort.current = controller;
    captureAnchor();
    setLoading(true);
    try {
      const response = await fetchHistory(
        paneId,
        { limit: HISTORY_PAGE_SIZE, before: oldest },
        session,
        controller.signal,
      );
      if (generation.current !== currentGeneration) return;
      if (!response.available) {
        setHasMore(false);
        return;
      }
      setEntries((current) => [...response.entries, ...current]);
      setRenderCount((count) => count + response.entries.length);
      setHasMore(response.hasMore);
      setFileTruncated(response.fileTruncated);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (generation.current !== currentGeneration) return;
      setStatus("Couldn't load older history", "error");
    } finally {
      if (generation.current === currentGeneration) setLoading(false);
      if (pagingAbort.current === controller) {
        pagingAbort.current = null;
        pagingInFlight.current = false;
      }
    }
  }, [captureAnchor, entries, hasMore, paneId, session]);

  const growUpward = useCallback(() => {
    if (!allRendered) {
      captureAnchor();
      setRenderCount((count) => Math.min(count + RENDER_STEP, entries.length));
      return;
    }
    if (hasMore) void loadOlder();
  }, [allRendered, captureAnchor, entries.length, hasMore, loadOlder]);

  useEffect(() => {
    const element = listRef.current?.getScrollElement();
    if (!element || entries.length === 0) return;
    const onScroll = () => {
      if (element.scrollTop < GROW_THRESHOLD && !loading) growUpward();
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => element.removeEventListener("scroll", onScroll);
  }, [entries.length, growUpward, listRef, loading]);

  useLayoutEffect(() => {
    if (!pendingRestore.current) return;
    pendingRestore.current = false;
    const previous = anchor.current;
    const element = listRef.current?.getScrollElement();
    if (previous && element) {
      element.scrollTop = previous.top + (element.scrollHeight - previous.height);
    }
    anchor.current = null;
  }, [listRef, shown]);

  if (entries.length === 0) {
    return failed ? (
      <button
        type="button"
        onClick={() => setRetry((value) => value + 1)}
        className="mb-3 flex w-full items-center justify-center rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors active:bg-muted/50"
      >
        Retry session history
      </button>
    ) : null;
  }

  return (
    <section aria-label="Session history" className="mb-5">
      {allRendered && !hasMore && (
        <div className="mb-3 text-center text-[11px] text-muted-foreground">
          {fileTruncated ? "Start of the readable transcript" : "Start of the conversation"}
        </div>
      )}
      <TranscriptView entries={shown} agent={agent} />
      <div className="mt-5 flex items-center gap-2" aria-label="Live terminal">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Live terminal
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </section>
  );
}
