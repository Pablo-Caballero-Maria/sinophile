/** Downloads a JSON file (of the site or a CDN); throws on an HTTP error. Check the result with zod. */
export async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
