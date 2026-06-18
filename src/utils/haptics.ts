/**
 * Utility for triggering haptic feedback on mobile devices where supported.
 * Designed to improve user accessibility and alert notification in noisy environments.
 */
export function triggerHaptic(pattern: number | number[] = [100]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Haptic feedback not supported or blocked by user gesture:", e);
    }
  }
}
