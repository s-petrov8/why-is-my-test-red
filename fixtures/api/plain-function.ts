import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ApiRequestParams, ApiRequestResponse } from './api-types';

/**
 * Simplified helper for making API requests and returning the status, body, and headers.
 * Performs the request based on the provided method, URL, payload, and headers.
 *
 * @param {APIRequestContext} request - The Playwright request context, used to make the HTTP request.
 * @param {ApiRequestParams} params - The parameters for the request.
 * @param {string} params.method - The HTTP method to use (POST, GET, PUT, DELETE, PATCH).
 * @param {string} params.url - The URL to send the request to.
 * @param {string} [params.baseUrl] - The base URL to prepend to the request URL.
 * @param {Record<string, unknown> | null} [params.body=null] - The JSON payload, sent as
 *   `application/json`. Mutually exclusive with `form` -- passing both is a compile error.
 * @param {Record<string, string>} [params.form] - Form-encoded payload, sent by Playwright as
 *   `application/x-www-form-urlencoded`. Use for endpoints that accept HTML form submissions
 *   rather than JSON. Mutually exclusive with `body`.
 * @param {number} [params.maxRedirects] - Maximum redirects to follow. Pass `0` to receive the
 *   redirect response itself so its `location` header can be asserted.
 * @param {string} [params.token] - Authentication credential, combined with `authType` into the
 *   `Authorization` header as `${authType} ${token}`.
 * @param {AuthType} [params.authType='Bearer'] - Authentication scheme to use (Bearer, Token, or Basic).
 * @param {Record<string, string>} [params.headers] - Custom request headers. Merged last, so they
 *   override both the derived `Content-Type` and the `Authorization` built from `token` --
 *   the escape hatch for values the `authType token` shape cannot express.
 * @returns {Promise<ApiRequestResponse>} - The status code, parsed response body, and response headers.
 *    - `status`: The HTTP status code returned by the server.
 *    - `body`: The parsed JSON or text response body from the server.
 *    - `headers`: The response headers, lower-cased by Playwright.
 */
export async function apiRequest(
    request: APIRequestContext,
    params: ApiRequestParams
): Promise<ApiRequestResponse> {
    const {
        method,
        url,
        baseUrl,
        body = null,
        form,
        maxRedirects,
        token,
        authType = 'Bearer',
        headers,
    } = params;

    let response: APIResponse;

    const options: {
        data?: Record<string, unknown> | null;
        form?: Record<string, string>;
        maxRedirects?: number;
        headers?: Record<string, string>;
    } = {};
    if (body) options.data = body;
    if (form) options.form = form;
    if (maxRedirects !== undefined) options.maxRedirects = maxRedirects;

    const requestHeaders: Record<string, string> = {};

    // Playwright sets `application/x-www-form-urlencoded` for `form` payloads,
    // so only declare JSON when we are not sending a form.
    if (!form) requestHeaders['Content-Type'] = 'application/json';
    if (token) requestHeaders['Authorization'] = `${authType} ${token}`;

    // Caller-supplied headers are merged last and therefore win -- including over
    // `Content-Type` and over the `Authorization` derived from `token`.
    // `Object.assign` with an `undefined` source is a no-op, so no guard is needed.
    Object.assign(requestHeaders, headers);

    options.headers = requestHeaders;

    const fullUrl = baseUrl ? `${baseUrl}${url}` : url;

    switch (method.toUpperCase()) {
        case 'POST':
            response = await request.post(fullUrl, options);
            break;
        case 'GET':
            response = await request.get(fullUrl, options);
            break;
        case 'PUT':
            response = await request.put(fullUrl, options);
            break;
        case 'DELETE':
            response = await request.delete(fullUrl, options);
            break;
        case 'PATCH':
            response = await request.patch(fullUrl, options);
            break;
        default:
            throw new Error(`Unsupported HTTP method: ${method}`);
    }

    const status = response.status();

    let bodyData: unknown = null;
    const contentType = response.headers()['content-type'] || '';

    try {
        if (contentType.includes('application/json')) {
            bodyData = await response.json();
        } else if (contentType.includes('text/')) {
            bodyData = await response.text();
        }
    } catch (err) {
        // eslint-disable-next-line no-console -- Important to log parsing failures for debugging
        console.warn(
            `Failed to parse response body for status ${status}: ${err}`
        );
    }

    return { status, body: bodyData, headers: response.headers() };
}
