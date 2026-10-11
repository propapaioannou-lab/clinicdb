// Breast implant size charts (decided 11 Oct 2026): volume (cc) → base width and
// projection (cm). Transcribed from the Motiva Round, Ergonomix and Ergonomix 2 charts the
// surgeon supplied on 11 Oct 2026. Check against the manufacturer's current catalogue when
// a new chart comes out. Mentor and Ergonomix 2 Mini/Demi: not loaded yet (typed by hand).

export type ChartRow = { cc: number; diameter: number; projection: number };

// Motiva Round, one row per base width:
// [width, Mini projection, Mini cc, Demi projection, Demi cc, Full projection, Full cc, Corsé projection, Corsé cc]
const ROUND: number[][] = [
  [8.5, 2.2, 105, 3.1, 135, 3.5, 145, 4.0, 180],
  [9, 2.3, 125, 3.3, 155, 3.7, 175, 4.2, 210],
  [9.5, 2.4, 140, 3.4, 180, 3.9, 205, 4.5, 240],
  [9.75, 2.4, 150, 3.4, 190, 4.0, 220, 4.6, 260],
  [10, 2.5, 160, 3.5, 205, 4.1, 235, 4.8, 280],
  [10.25, 2.5, 170, 3.5, 215, 4.2, 255, 4.9, 300],
  [10.5, 2.6, 185, 3.6, 230, 4.3, 275, 5.1, 325],
  [10.75, 2.6, 205, 3.7, 245, 4.4, 295, 5.2, 350],
  [11, 2.7, 220, 3.8, 265, 4.5, 315, 5.4, 380],
  [11.25, 2.7, 230, 3.8, 285, 4.6, 335, 5.5, 410],
  [11.5, 2.8, 245, 3.9, 300, 4.7, 355, 5.7, 440],
  [11.75, 2.8, 260, 3.9, 320, 4.8, 375, 5.8, 475],
  [12, 2.9, 275, 4.0, 340, 4.9, 400, 6.0, 510],
  [12.25, 2.9, 290, 4.0, 360, 5.0, 425, 6.1, 550],
  [12.5, 3.0, 310, 4.1, 380, 5.1, 450, 6.3, 590],
  [13, 3.1, 360, 4.3, 425, 5.3, 500, 6.6, 650],
  [13.5, 3.2, 400, 4.4, 475, 5.5, 550, 6.9, 725],
  [14, 3.3, 430, 4.5, 525, 5.7, 625, 7.2, 825],
  [14.5, 3.4, 475, 4.6, 575, 5.9, 700, 7.5, 925],
  [15, 3.5, 525, 4.8, 625, 6.1, 775, 7.8, 1050],
];
const PROFILES = ["mini", "demi", "full", "corse"] as const;
const fromRound = (profile: (typeof PROFILES)[number], maxWidth = Infinity): ChartRow[] => {
  const i = PROFILES.indexOf(profile);
  return ROUND.filter((r) => r[0] <= maxWidth).map((r) => ({ diameter: r[0], projection: r[1 + i * 2], cc: r[2 + i * 2] }));
};

// Motiva Ergonomix 2: [width, Full projection, Full cc, Corsé projection, Corsé cc]
const ERGONOMIX2: number[][] = [
  [8, 3.3, 135, 3.8, 160],
  [8.5, 3.5, 155, 4.0, 190],
  [9, 3.7, 190, 4.2, 220],
  [9.5, 3.9, 215, 4.5, 255],
  [9.75, 4.0, 240, 4.6, 270],
  [10, 4.1, 250, 4.8, 290],
  [10.25, 4.2, 275, 4.9, 320],
  [10.5, 4.3, 290, 5.1, 340],
  [10.75, 4.4, 320, 5.2, 370],
  [11, 4.5, 330, 5.4, 395],
  [11.25, 4.6, 355, 5.5, 425],
  [11.5, 4.7, 380, 5.7, 455],
  [11.75, 4.8, 400, 5.8, 495],
  [12, 4.9, 430, 6.0, 530],
  [12.25, 5.0, 450, 6.1, 575],
  [12.5, 5.1, 475, 6.3, 615],
  [13, 5.3, 535, 6.6, 675],
  [13.5, 5.5, 595, 6.9, 755],
  [14, 5.7, 670, 7.2, 860],
  [14.5, 5.9, 750, 7.5, 965],
  [15, 6.1, 825, 7.8, 1060],
];

// "maker:line:profile" → sizes. Ergonomix has the Round sizes, Corsé only up to 12.5 cm.
export const IMPLANT_CHARTS: Record<string, ChartRow[]> = {
  ...Object.fromEntries(PROFILES.map((p) => [`motiva:round:${p}`, fromRound(p)])),
  ...Object.fromEntries(PROFILES.map((p) => [`motiva:ergonomix:${p}`, fromRound(p, p === "corse" ? 12.5 : Infinity)])),
  "motiva:ergonomix2:full": ERGONOMIX2.map((r) => ({ diameter: r[0], projection: r[1], cc: r[2] })),
  "motiva:ergonomix2:corse": ERGONOMIX2.map((r) => ({ diameter: r[0], projection: r[3], cc: r[4] })),
};
