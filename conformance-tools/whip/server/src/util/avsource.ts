import { createCanvas } from "canvas";

const { RTCAudioSource, RTCVideoSource, i420ToRgba, rgbaToI420, RTCAudioSink, RTCVideoSink } = require('@koush/wrtc').nonstandard;

const AUDIO_SAMPLE_RATE = 48000;
const AUDIO_CHANNEL_COUNT = 2;
const AUDIO_BITS_PER_SAMPLE = 16;

const twoPi = 2 * Math.PI;

export class AVSource {
  private audioSource;
  private videoSource;
  private audioInterval;
  private videoInterval;
  private audioTrack;
  private videoTrack;
  private audioSink;
  private videoSink;

  constructor() {
    const numberOfAudioFrames = AUDIO_SAMPLE_RATE / 100;
    const secondsPerAudioSample = 1 / AUDIO_SAMPLE_RATE;
    const maxValue = Math.pow(2, AUDIO_BITS_PER_SAMPLE) / 2 - 1;

    this.audioSource = new RTCAudioSource();
    this.videoSource = new RTCVideoSource();

    this.audioTrack = this.audioSource.createTrack();
    this.videoTrack = this.videoSource.createTrack();

    this.audioSink = new RTCAudioSink(this.audioTrack);
    this.videoSink = new RTCVideoSink(this.videoTrack);

    const audioSamples = new Int16Array(AUDIO_CHANNEL_COUNT * numberOfAudioFrames);

    const audioData = {
      samples: audioSamples,
      sampleRate: AUDIO_SAMPLE_RATE,
      bitsPerSample: AUDIO_BITS_PER_SAMPLE,
      channelCount: AUDIO_CHANNEL_COUNT,
      numberOfFrames: numberOfAudioFrames
    };

    const a = [1, 1];
    let time = 0;
    function nextAudio() {
      for (let i = 0; i < numberOfAudioFrames; i++, time += secondsPerAudioSample) {
        for (let j = 0; j < AUDIO_CHANNEL_COUNT; j++) {
          audioSamples[i * AUDIO_CHANNEL_COUNT + j] = a[j] * Math.sin(twoPi * 440 * time) * maxValue;
        }
      }
      this.audioSource.onData(audioData);
    }
    
    const canvas = createCanvas(640, 480);
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgb(0, 0, 0)';
    context.fillRect(0, 0, 640, 480);

    function nextVideoFrame() {
      const rgbaFrame = context.getImageData(0, 0, 640, 480);
      const i420Frame = {
        width: 640,
        height: 480,
        data: new Uint8ClampedArray(1.5 * 640 * 480)
      };
      rgbaToI420(rgbaFrame, i420Frame);
      this.videoSource.onFrame(i420Frame);
    }

    this.audioInterval = setInterval(nextAudio.bind(this), 1000);
    this.videoInterval = setInterval(nextVideoFrame.bind(this), 25);

    this.audioSink.ondata = (data) => {
      // console.log("audio: onData");
    };

    this.videoSink.onframe = ({ frame }) => {
      // console.log("video: onframe");
    };
  }

  getAudioTrack() {
    return this.audioTrack;
  }

  getVideoTrack() {
    return this.videoTrack;
  }

  stop() {
    this.audioSink.stop();
    this.videoSink.stop();

    this.audioTrack.stop();
    this.videoTrack.stop();

    clearInterval(this.audioInterval);    
    clearInterval(this.videoInterval);
  }
}