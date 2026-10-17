/**
 * Distance display conditions for the visual representation layer.
 * Geometry stays on the real footprint; only GPU detail changes with range.
 *
 * LOD 0 far   — mipmapped façade reads as massing / material color
 * LOD 1 mid   — window grid and semantic billboards readable
 * LOD 2 close — POI 3D markers + labels
 */

export const LOD_FAR_M = 12_000;
export const LOD_MID_M = 3_500;
export const LOD_CLOSE_M = 900;

export const POI_POINT_MAX_M = 40_000;
export const POI_BILLBOARD_MAX_M = 8_000;
export const POI_LABEL_MAX_M = 2_500;
export const POI_MARKER_3D_MAX_M = 700;

export const ROAD_LABEL_MAX_M = 1_200;

export type VisualLod = 0 | 1 | 2;

export function lodFromCameraHeight(heightM: number): VisualLod {
  if (heightM > LOD_FAR_M) return 0;
  if (heightM > LOD_CLOSE_M) return 1;
  return 2;
}
