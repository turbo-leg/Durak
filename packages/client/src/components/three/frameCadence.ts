/** Keeps display refresh rates from changing the table's rendering budget. */
export class FrameCadence {
  private dueAt = 0;
  private fps = 0;

  shouldRender(now: number, fps: number): boolean {
    const interval = 1000 / fps;
    if (this.fps !== fps || now - this.dueAt >= interval) {
      this.fps = fps;
      this.dueAt = now + interval;
      return true;
    }
    // RAF timestamps have small rounding differences, even on a 60 Hz display.
    if (now + 0.25 < this.dueAt) return false;
    this.dueAt += interval;
    return true;
  }
}
