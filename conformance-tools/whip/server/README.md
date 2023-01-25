# WHIP Endpoint Conformance Tests

Test suite to verify that a WHIP endpoint is protocol compliant. Suite based on NodeJS and WebRTC bindings for NodeJS.

## Installation

```
npm install
```

## Verify WHIP Endpoint

To verify that a WHIP endpoint at `<WHIP-URL>` is compliant with the specification run the following command:

```
WHIP_ENDPOINT=<WHIP-URL> npm run test:whip
```

It will check the following:

WHIP
  - endpoint returns HTTP 405 for any "GET"
  - endpoint returns HTTP 405 for any "HEAD"
  - endpoint returns HTTP 405 for any "PUT"
  - endpoint will return an application/sdp on "POST"
  - endpoint can signal that it accepts application/sdp
  - SDP answer uses the recvonly attribute
  - resource returns HTTP 405 for any "GET"
  - resource returns HTTP 405 for any "HEAD"
  - resource returns HTTP 405 for any "POST"
  - resource returns HTTP 405 for any "PUT"
  - resource can be deleted
  - resource can handle trickle ICE attempt
  - resource can handle ICE restart attempt
