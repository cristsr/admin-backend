/** The body every failed request answers with, whatever went wrong. */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  path: string;
  timestamp: string;
}
