export function errorDetails(error) {
  const statusCode =
    error.statusCode ??
    (error.code && /^(EACCES|EPERM|EIO|ENOSPC|ENOENT|EISDIR)$/.test(error.code) ? 500 : 400);
  const message = error instanceof Error ? error.message : "Request failed";
  const field =
    error.field ??
    message.match(
      /(?:^|: )(releases\[\d+\]\.[a-z]+|support\.[a-z]+|resources\.[a-z]+|platforms|category|tags|description|name|guide|order|id)\b/i,
    )?.[1];
  return {
    statusCode,
    error: message,
    code: error.code ?? (statusCode >= 500 ? "INTERNAL_ERROR" : "VALIDATION_ERROR"),
    ...(field ? { field } : {}),
  };
}
