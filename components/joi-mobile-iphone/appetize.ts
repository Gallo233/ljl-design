const DEFAULT_APPETIZE_BUILD_ID = "b_6xgll65a5isnvviou52jguiw7q";

export const JOI_MOBILE_APPETIZE_BUILD_ID =
  process.env.NEXT_PUBLIC_JOI_MOBILE_APPETIZE_BUILD_ID
  ?? DEFAULT_APPETIZE_BUILD_ID;

export const JOI_MOBILE_APPETIZE_URL =
  `https://appetize.io/app/${JOI_MOBILE_APPETIZE_BUILD_ID}`
  + "?device=iphone14pro&osVersion=26.0&orientation=portrait";
