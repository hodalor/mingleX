import { HttpError } from "./httpError.js";

export function routeParam(value: string | string[] | undefined): string {
  const param = Array.isArray(value) ? value[0] : value;
  if (!param) {
    throw new HttpError(400, "Missing route parameter");
  }
  return param;
}
