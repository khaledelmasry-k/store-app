// Preact event types are stricter; cast target for common form handlers
interface EventTarget {
  value: string;
  checked: boolean;
  files: FileList | null;
}
interface Event {
  target: EventTarget;
}
