/** Supported authentication schemes for API requests */
export type AuthType = 'Bearer' | 'Token' | 'Basic';

/**
 * Fields shared by every API request, regardless of payload style.
 * @typedef {Object} ApiRequestBase
 * @property {'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH'} method - The HTTP method to use.
 * @property {string} url - The endpoint URL for the request.
 * @property {string} [baseUrl] - The base URL to prepend to the endpoint.
 * @property {number} [maxRedirects] - Maximum redirects to follow. Pass `0` to assert on a
 *   redirect response itself rather than its target.
 * @property {string} [token] - Authentication credential. Combined with `authType` into the
 *   `Authorization` header (`${authType} ${token}`).
 * @property {AuthType} [authType] - Authentication scheme to use (default: 'Bearer').
 * @property {Record<string, string>} [headers] - Custom request headers. Merged last and
 *   therefore winning over the derived `Content-Type` and `Authorization`.
 */
type ApiRequestBase = {
    method: 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    baseUrl?: string;
    maxRedirects?: number;
    token?: string;
    authType?: AuthType;
    headers?: Record<string, string>;
};

/**
 * JSON payload variant -- sends `application/json`.
 * @typedef {Object} JsonPayload
 * @property {Record<string, unknown> | null} [body] - The JSON request payload, if applicable.
 * @property {never} [form] - Forbidden on this variant; `body` and `form` are exclusive.
 */
type JsonPayload = {
    body?: Record<string, unknown> | null;
    form?: never;
};

/**
 * Form-encoded variant -- sends `application/x-www-form-urlencoded`.
 * @typedef {Object} FormPayload
 * @property {Record<string, string>} form - Form-encoded payload, for endpoints that accept
 *   HTML form submissions rather than JSON.
 * @property {never} [body] - Forbidden on this variant; `body` and `form` are exclusive.
 */
type FormPayload = {
    form: Record<string, string>;
    body?: never;
};

/**
 * Parameters for making an API request.
 *
 * `body` and `form` are mutually exclusive: passing both matches neither union member and is a
 * compile error. Passing neither is legal (the common case for `GET`s). The `?: never` markers
 * are deliberate -- they keep both keys present on the union so the implementation can still
 * destructure `{ body, form }`.
 */
export type ApiRequestParams = ApiRequestBase & (JsonPayload | FormPayload);

/**
 * Response from an API request.
 * @template T
 * @typedef {Object} ApiRequestResponse
 * @property {number} status - The HTTP status code of the response.
 * @property {T} body - The response body.
 * @property {Record<string, string>} headers - The response headers, lower-cased by Playwright.
 *   Needed to assert on `location` when a redirect is not followed.
 */
export type ApiRequestResponse<T = unknown> = {
    status: number;
    body: T;
    headers: Record<string, string>;
};

// define the function signature as a type
export type ApiRequestFn = <T = unknown>(
    params: ApiRequestParams
) => Promise<ApiRequestResponse<T>>;

// grouping them all together
export type ApiRequestMethods = {
    apiRequest: ApiRequestFn;
};
