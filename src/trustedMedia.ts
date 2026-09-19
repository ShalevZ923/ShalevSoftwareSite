const localImagePath = /^\/tool-images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function getTrustedImageSource(source?: string) {
  return source && localImagePath.test(source) && !source.includes("..")
    ? source
    : undefined;
}
