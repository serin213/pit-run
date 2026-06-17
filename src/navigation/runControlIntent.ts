export type RunControlIntent = 'pause' | 'resume' | 'stop';

let pendingIntent: RunControlIntent | null = null;

export function setPendingRunControlIntent(intent: RunControlIntent): void {
  pendingIntent = intent;
}

export function consumePendingRunControlIntent(): RunControlIntent | null {
  const intent = pendingIntent;
  pendingIntent = null;
  return intent;
}
