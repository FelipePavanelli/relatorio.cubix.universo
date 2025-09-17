// Centralized chart palette using Univalores brand colors
// Based on https://www.univalores.com.br/ brand identity

const BRAND_BASE_HEX = "#1e40af"; // Univalores primary blue
const BRAND_SECONDARY_HEX = "#059669"; // Univalores green
const BRAND_ACCENT_HEX = "#f59e0b"; // Univalores gold/orange accent

// Small helpers
function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => {
        const clamped = Math.round(clamp(v / 255, 0, 1) * 255);
        const h = clamped.toString(16);
        return h.length === 1 ? "0" + h : h;
      })
      .join("")
  );
}

// Color conversions for hue rotations
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1/3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1/3);
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function rotateHue(hex: string, degrees: number, sat?: number, lig?: number): string {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  const h = (hsl.h + degrees + 360) % 360;
  const s = sat != null ? sat : hsl.s;
  const l = lig != null ? lig : hsl.l;
  return hslToHex(h, s, l);
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const nr = r + (255 - r) * clamp(amount);
  const ng = g + (255 - g) * clamp(amount);
  const nb = b + (255 - b) * clamp(amount);
  return rgbToHex(nr, ng, nb);
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const nr = r * (1 - clamp(amount));
  const ng = g * (1 - clamp(amount));
  const nb = b * (1 - clamp(amount));
  return rgbToHex(nr, ng, nb);
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha)})`;
}

// Build a set of series colors using Univalores brand colors
const primary = BRAND_BASE_HEX; // Blue
const secondary = BRAND_SECONDARY_HEX; // Green
const accent = BRAND_ACCENT_HEX; // Gold/Orange

// Create variations of the primary colors for chart series
const series = [
  primary,                    // #1e40af - Primary blue
  secondary,                  // #059669 - Green
  accent,                     // #f59e0b - Gold/Orange
  lighten(primary, 0.2),      // Lighter blue
  darken(primary, 0.2),       // Darker blue
  lighten(secondary, 0.2),    // Lighter green
  darken(secondary, 0.2),     // Darker green
  lighten(accent, 0.2),       // Lighter gold
];

export const chartPalette = {
  // Primary brand colors
  primary: primary,           // #1e40af - Univalores blue
  secondary: secondary,       // #059669 - Univalores green
  accent: accent,            // #f59e0b - Univalores gold
  
  // Chart series colors
  series,
  
  // Semantic variants
  emphasis: darken(primary, 0.3),    // Darker blue for emphasis
  subtle: lighten(primary, 0.4),     // Lighter blue for subtle elements
  success: secondary,                 // Green for success states
  warning: accent,                    // Gold for warnings
  
  // Legacy compatibility
  base: primary,
  
  // Helpers
  alpha: {
    4: withAlpha(primary, 0.04),
    8: withAlpha(primary, 0.08),
    12: withAlpha(primary, 0.12),
    16: withAlpha(primary, 0.16),
    24: withAlpha(primary, 0.24),
    32: withAlpha(primary, 0.32),
    40: withAlpha(primary, 0.40),
  },
  tint: (amt: number) => lighten(primary, amt),
  shade: (amt: number) => darken(primary, amt),
  alphaOf: (hex: string, a: number) => withAlpha(hex, a),
};

export default chartPalette;


