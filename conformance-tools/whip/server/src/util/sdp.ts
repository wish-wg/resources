import { IceCredentials } from './dummy';
import { SessionDescription, parse, write } from 'sdp-transform'

export function makeSDPTransformCandidate(candidate: RTCIceCandidate) {
  return {
    foundation: candidate.foundation,
    component: candidate.component === 'rtp' ? 0 : 1,
    transport: candidate.protocol.toString(),
    priority: candidate.priority,
    ip: candidate.address,
    port: candidate.port,
    type: candidate.type.toString(),
    raddr: candidate?.relatedAddress,
    rport: candidate?.relatedPort,
    tcptype: candidate?.tcpType?.toString()
  }
}

export function makeTrickleIceSdpFragment(candidate: RTCIceCandidate, 
  mediaMids: Array<string>, 
  credentials: IceCredentials) 
{
  let trickleIceSDP: SessionDescription = {
    media: [],
    iceUfrag: credentials.ufrag,
    icePwd: credentials.pwd
  };

  for (let mediaMid of mediaMids) {
    const media = {
      type: 'audio',
      port: 9,
      protocol: 'RTP/AVP',
      payloads: '0',
      rtp: [],
      fmtp: [],
      mid: mediaMid,
      candidates: [
        makeSDPTransformCandidate(candidate)
      ]
    };
    trickleIceSDP.media.push(media);
  }

  const trickleIceSDPString = write(trickleIceSDP);
  // sdp-transform appends standard SDP fields that are not used in 
  // WHIP trickle ICE SDP fragments, remove them from the result.
  return trickleIceSDPString.replace('v=0\r\ns= \r\n', '');
}

export function makeIceRestartSdpFragment(credentials: IceCredentials) {
  let iceRestartSDP: SessionDescription = {
    iceUfrag: credentials.ufrag,
    icePwd: credentials.pwd
  };
  return iceRestartSDP;
}