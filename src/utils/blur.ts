/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Estimates how sharp (in-focus) a captured frame is using a simplified
 * Laplacian-variance method: the source is downscaled to a small grayscale
 * sample, a basic edge-detection kernel is applied, and the variance of the
 * result is measured. Sharp, in-focus photos have lots of high-contrast edges
 * (high variance). Blurry photos look "smooth" with few sharp edges (low
 * variance).
 *
 * This is a heuristic, not a guarantee - it flags LIKELY blur so the operator
 * can double check, it does not replace the manual "Validasi Foto" step.
 */
export function estimateSharpness(source: HTMLCanvasElement, sampleSize = 160): number {
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Infinity; // If we can't analyze it, don't falsely warn the operator

  try {
    ctx.drawImage(source, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

    // Convert to a grayscale intensity buffer
    const gray = new Float32Array(sampleSize * sampleSize);
    for (let i = 0; i < gray.length; i++) {
      const o = i * 4;
      gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }

    // Apply a simple Laplacian (edge-detection) kernel and measure its variance
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 1; y < sampleSize - 1; y++) {
      for (let x = 1; x < sampleSize - 1; x++) {
        const idx = y * sampleSize + x;
        const lap =
          4 * gray[idx] -
          gray[idx - 1] -
          gray[idx + 1] -
          gray[idx - sampleSize] -
          gray[idx + sampleSize];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }

    const mean = sum / count;
    return sumSq / count - mean * mean;
  } catch (err) {
    console.warn("Gagal menganalisa ketajaman foto:", err);
    return Infinity; // Fail open - don't block the operator on an analysis error
  }
}

// Below this variance, a capture is considered likely blurry. Tuned empirically for
// compressed ~640px-wide JPEG captures from a phone camera at typical pickup distance.
// If you see too many false warnings (sharp photos flagged) lower this number; if
// genuinely blurry photos slip through, raise it.
export const BLUR_WARNING_THRESHOLD = 60;
