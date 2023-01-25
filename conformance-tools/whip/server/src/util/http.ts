import fetch from "node-fetch";

export async function httpreq(endpoint: string, method: string, body?: string) {
  return await fetch(endpoint, {
    method: method,
    headers: {
      'Content-Type': 'application/sdp'
    },
    body: body
  });
}