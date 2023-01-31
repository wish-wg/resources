import { RTCPeerConnection } from "@koush/wrtc";
import { AVSource } from "./avsource";
import { SessionDescription, parse } from 'sdp-transform'

export interface IceCredentials {
  ufrag: string;
  pwd: string
}

export class DummySourceStream {
  private source: AVSource;
  private pc: RTCPeerConnection;
  private candidates: RTCIceCandidate[];
  private mediaMids: Array<string>;
  private iceCredentials: IceCredentials;

  constructor() {
    this.source = new AVSource();
    this.pc = new RTCPeerConnection();
    this.pc.addTrack(this.source.getAudioTrack());
    this.pc.addTrack(this.source.getVideoTrack());
    this.pc.addEventListener('icecandidate', this.onIceCandidate.bind(this));

    this.candidates = [];
    this.mediaMids = [];
  }

  private onIceCandidate(event: Event) {
    if (event.type !== 'icecandidate') {
      return;
    }
    const candidateEvent = <RTCPeerConnectionIceEvent>(event);
    const candidate: RTCIceCandidate | null = candidateEvent.candidate;
    if (!candidate) {
      return;
    }
    this.candidates.push(candidate);
  }

  waitForAnyIceCandidate(): Promise<RTCIceCandidate> {
    return new Promise((resolve, reject) => {
      const t = setInterval(() => {
        if (this.candidates.length === 0) {
          return;
        }
        this.pc.removeEventListener('icecandidate', this.onIceCandidate.bind(this));
        clearInterval(t);
        resolve(this.candidates[0]);
      }, 500);
    });
  }

  getMediaMids(): Array<string> {
    return this.mediaMids;
  }

  getIceCredentials(): IceCredentials {
    return this.iceCredentials;
  }

  async before(): Promise<string> {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });
    const parsedOffer: SessionDescription = offer.sdp && parse(offer.sdp);

    if (parsedOffer.iceUfrag && parsedOffer.icePwd) {
      this.iceCredentials = {
        pwd: parsedOffer.icePwd,
        ufrag: parsedOffer.ufrag
      };
    } else if (parsedOffer.media.length !== 0 &&
      parsedOffer.media[0].iceUfrag &&
      parsedOffer.media[0].icePwd) 
    {
      this.iceCredentials = {
        pwd: parsedOffer.media[0].icePwd,
        ufrag: parsedOffer.media[0].iceUfrag
      };
    }

    for (let media of parsedOffer.media) {
      if (media.mid) {
        this.mediaMids.push(media.mid);
      }
    }
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription.sdp;
  }

  async after(sdpAnswer) {
    await this.pc.setRemoteDescription({
      type: 'answer',
      sdp: sdpAnswer
    });
  }

  end() {
    const senders = this.pc.getSenders();
    if (senders) {
      senders.forEach(sender => {
        sender.track.stop();
      });
    }
    this.pc.close();    
    this.source.stop();
    this.pc = null;
  }
}