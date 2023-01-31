import fetch from "node-fetch";
import { SessionDescription, parse } from 'sdp-transform'

import { DummySourceStream } from "./util/dummy";
import { httpreq } from "./util/http";
import { makeTrickleIceSdpFragment, makeIceRestartSdpFragment } from "./util/sdp";

async function testResource405(endpoint: string, method: string) {
  const stream = new DummySourceStream();
  const sdp = await stream.before();

  let response = await httpreq(endpoint, 'POST', sdp);
  expect(response.status).toEqual(201);
  const location = response.headers.get('Location');

  response = await httpreq(location, method);
  expect(response.status).toEqual(405);
  stream.end();  
}

describe('WHIP', () => {
  let endpoint;

  beforeAll(() => {
    if (!process.env.WHIP_ENDPOINT) {
      console.error('Missing WHIP_ENDPOINT environment variable');
      process.exit(1);
    }
    endpoint = process.env.WHIP_ENDPOINT;
  });

  it.each([ 
    'GET', 'HEAD', 'PUT'
  ])('endpoint returns HTTP 405 for any %p', async (method: string) => {
    const response = await httpreq(endpoint, method);
    expect(response.status).toEqual(405);
  });

  test('endpoint will return an application/sdp on "POST"', async () => {
    const stream = new DummySourceStream();
    const sdp = await stream.before();

    const response = await httpreq(endpoint, 'POST', sdp);
    expect(response.status).toEqual(201);
    const location = response.headers.get('Location');
    expect(location).not.toBeNull();
    expect(response.headers.get('Content-Type')).toEqual('application/sdp');

    stream.end();
  });

  test('endpoint can signal that it accepts application/sdp', async () => {
    const stream = new DummySourceStream();
    const sdp = await stream.before();

    const response = await fetch(endpoint, { method: 'OPTIONS' });
    expect(response.status).toEqual(200);
    expect(response.headers.get('Accept-Post')).toEqual('application/sdp');

    stream.end();
  });

  test('SDP answer uses the recvonly attribute', async () => {
    const stream = new DummySourceStream();
    const sdp = await stream.before();

    const response = await httpreq(endpoint, 'POST', sdp);
    if (response.ok) {
      const sdp = await response.text();
      const parsedSdp: SessionDescription = parse(sdp);
      // The SDP offer SHOULD use the "sendonly" attribute and the SDP answer MUST 
      // use the "recvonly" attribute.
      parsedSdp.media.map(m => {
        expect(m.direction).toEqual('recvonly');
      });
    }

    stream.end();
  });

  it.each([ 
    'GET', 'HEAD', 'POST', 'PUT'
  ])('resource returns HTTP 405 for any %p', async (method: string) => {
    await testResource405(endpoint, method);
  });

  test('resource can be deleted', async () => {
    const stream = new DummySourceStream();
    const sdp = await stream.before();

    const response = await httpreq(endpoint, 'POST', sdp);
    if (response.ok) {
      const location = response.headers.get('Location');
      const sdp = await response.text();
      await stream.after(sdp);

      const deleteResponse = await fetch(location, { method: 'DELETE' });
      if (deleteResponse.ok) {
        expect(deleteResponse.status).toEqual(200);
      }
    }

    stream.end();
  });

  test('resource can handle trickle ICE attempt', async () => {
    const stream = new DummySourceStream();
    
    const sdp = await stream.before();
    const response = await httpreq(endpoint, 'POST', sdp);
    if (response.ok) {
      const location = response.headers.get('Location');
      expect(response.headers.get("ETag")).not.toBeUndefined();
      const eTag = response.headers.get("ETag");

      const sdp = await response.text();
      await stream.after(sdp);
      const candidate = await stream.waitForAnyIceCandidate();
      const trickleIceSDP = 
        makeTrickleIceSdpFragment(candidate, stream.getMediaMids(), stream.getIceCredentials());
      
      const patchResponse = await fetch(location, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/trickle-ice-sdpfrag',
          'ETag': eTag,
        },
        body: trickleIceSDP
      });
      if (patchResponse.ok) {
        expect(response.headers.get('Accept-Patch')).toEqual('application/trickle-ice-sdpfrag');
        expect(patchResponse.status).toEqual(204);
        expect(patchResponse.headers.get('Content-Type')).toEqual('application/trickle-ice-sdpfrag');
      } else {
        expect(response.headers.get('Accept-Patch')).toBeNull();
        // If the WHIP resource supports either Trickle ICE or ICE restarts, but not both, it 
        // MUST return a 405 (Not Implemented) for the HTTP PATCH requests that are not supported.
        // If the WHIP resource does not support the PATCH method for any purpose, 
        // it returns a 501 (Not Implemented), as described in [RFC9110] section 6.6.2.
        expect([405, 501]).toContain(patchResponse.status);
      }
    }
    stream.end();
  });

  test('resource can handle ICE restart attempt', async () => {
    const stream = new DummySourceStream();

    const sdp = await stream.before();
    const response = await httpreq(endpoint, 'POST', sdp);
    if (response.ok) {
      const location = response.headers.get('Location');
      const sdp = await response.text();
      await stream.after(sdp);
      const candidate = await stream.waitForAnyIceCandidate();
      const iceRestartSDP =
        makeIceRestartSdpFragment(stream.getIceCredentials());

      const patchResponse = await fetch(location, {
        method: 'PATCH',
        headers: {
          'If-Match': '*',
          'Content-Type': 'application/trickle-ice-sdpfrag'
        },
        body: iceRestartSDP
      });
      if (patchResponse.ok) {
        expect(response.headers.get('Accept-Patch')).toEqual('application/trickle-ice-sdpfrag');
        expect(patchResponse.status).toEqual(200);
        expect(patchResponse.headers.get('Content-Type')).toEqual('application/trickle-ice-sdpfrag');
        expect(patchResponse.headers.get('ETag')).not.toBeUndefined();
        const sdp = await patchResponse.text();
        const parsedSdp: SessionDescription = parse(sdp);
        expect(parsedSdp.iceUfrag).not.toBeUndefined();
        expect(parsedSdp.icePwd).not.toBeUndefined();
      } else {
        expect(response.headers.get('Accept-Patch')).toBeNull();
        // If the WHIP resource supports either Trickle ICE or ICE restarts, but not both, it 
        // MUST return a 405 (Not Implemented) for the HTTP PATCH requests that are not supported.
        // If the WHIP resource does not support the PATCH method for any purpose, 
        // it returns a 501 (Not Implemented), as described in [RFC9110] section 6.6.2.
        expect([405, 501]).toContain(patchResponse.status);
      }    
    }
    stream.end();
  });
});