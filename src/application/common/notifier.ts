export type NoticeKind = "info" | "good" | "bad";

export interface Notice {
  id: number;
  text: string;
  kind: NoticeKind;
}

/** Short-lived player notifications (toasts). */
export class Notifier {
  items: Notice[] = [];
  private nextId = 0;

  constructor(
    private readonly onChange: () => void,
    private readonly ttlMs = 3200,
    private readonly max = 4,
  ) {}

  push(text: string, kind: NoticeKind = "info") {
    const id = ++this.nextId;
    this.items = [...this.items.slice(-(this.max - 1)), { id, text, kind }];
    this.onChange();
    setTimeout(() => this.dismiss(id), this.ttlMs);
  }

  dismiss(id: number) {
    const next = this.items.filter((n) => n.id !== id);
    if (next.length === this.items.length) return;
    this.items = next;
    this.onChange();
  }
}
