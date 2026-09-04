import { Image, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ChatAttachmentProps {
  index: number;
  path: string;
  removeLabel: string;
  onRemove: () => void;
}

/** A file queued beside a chat draft. The path stays available to the terminal but out of the field. */
export function ChatAttachment({ index, path, removeLabel, onRemove }: ChatAttachmentProps) {
  return (
    <div
      className="flex h-9 max-w-full items-center gap-2 rounded-md border border-border bg-muted px-2 text-xs text-foreground"
      title={path}
    >
      <Image className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate font-medium">[Image #{index + 1}]</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-mr-1 size-7 shrink-0 rounded-full text-muted-foreground"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
