export const ASSET_TYPE = {
  IMAGE: "IMAGE",
  LINK: "LINK",
  PDF: "PDF",
  FILE: "FILE",
  VIDEO: "VIDEO",
  OTHER: "OTHER",
} as const;

export const ASSET_TYPES = ASSET_TYPE;

export type AssetType = keyof typeof ASSET_TYPE;
