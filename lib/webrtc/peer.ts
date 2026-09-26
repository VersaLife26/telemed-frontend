/**
 * The call itself: one RTCPeerConnection between exactly two people.
 *
 * There is no SFU in the path,
 * so what would have been the server's job -- deciding how much bitrate a
 * degraded link should carry, noticing a connection died and rebuilding it --
 * has to happen here. That is what the two features below are:
 *
 *   ADAPTIVE BITRATE. getStats is polled and the outbound video encoding's
 *   maxBitrate is moved up or down through a ladder. An SFU does this by
 *   dropping simulcast layers; a peer connection has one layer, so the encoder
 *   itself is retargeted.
 *
 *   AUTO RECONNECT. An RTCPeerConnection that goes to "failed" never recovers
 *   on its own. The fix is an ICE restart -- a fresh offer with fresh
 *   candidates over the same connection -- which is invisible to the user if
 *   it lands quickly, and is why the signalling socket has to stay reachable
 *   for the whole call even though it is idle for most of it.
 */

import type { Consultation, ConsultationMessage } from "@/lib/consumer/api/types";
import type { PointerState } from "@/lib/consumer/features/pointer";
import { parsePointer } from "@/lib/consumer/features/pointer";
import {
  FrameType,
  SignalingClient,
  type Envelope,
  type ICEServer,
  type Welcome,
} from "@/lib/webrtc/signaling";

export type CallState =
  | "idle"
  | "waiting-for-peer"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "ended";

export type CallQuality = {
  /** Round-trip time in milliseconds, or null before the first sample. */
  rttMs: number | null;
  /** Fraction of packets lost, 0..1. */
  packetLoss: number;
  /** Outbound video bitrate actually being sent, in kbps. */
  outboundKbps: number;
  /** Inbound video bitrate being received, in kbps. */
  inboundKbps: number;
  /** What the encoder is currently targeted at, in kbps. */
  targetKbps: number;
  frameWidth: number | null;
  frameHeight: number | null;
  /** Whether the selected candidate pair is going through a TURN relay. */
  relayed: boolean;
};

export type PeerHandlers = {
  onRemoteStream?: (stream: MediaStream) => void;
  onStateChange?: (state: CallState) => void;
  onQuality?: (q: CallQuality) => void;
  onRemoteQuality?: (q: CallQuality) => void;
  /** A signalling-level error frame from the server. */
  onError?: (code: string, message: string) => void;
  /** The hub accepted this connection (also after every signalling reconnect). */
  onWelcome?: () => void;
  /** The server closed the room; `replaced` means this user connected elsewhere. */
  onRoomClosed?: (reason: string) => void;
  /** The consultation changed state (waiting, admitted, started, ended). */
  onConsultation?: (consultation: Consultation) => void;
  /** A persisted chat message, including this participant's own. */
  onMessage?: (message: ConsultationMessage) => void;
  onPointer?: (pointer: PointerState) => void;
  onFileShared?: (file: { name: string }) => void;
  /** Screen capture stopped outside setScreenShare, e.g. from the browser's own "Stop sharing" bar. */
  onScreenShareEnded?: () => void;
  onLog?: (line: string) => void;
};

/** Error codes the signalling hub can send. */
export const SIGNAL_ERROR = {
  unknownType: "UNKNOWN_TYPE",
  malformed: "MALFORMED",
  noPeer: "NO_PEER",
} as const;

/**
 * The bitrate ladder, in kbps, worst first.
 *
 * The bottom rung is chosen to still be a usable consultation rather than a
 * technically-live connection: below roughly 150kbps a face becomes a smear,
 * and a doctor who cannot see a rash or a jaundiced eye is not doing
 * telemedicine. If the link cannot hold the bottom rung, the honest outcome is
 * to tell both parties to switch to audio, not to keep degrading video.
 */
const BITRATE_LADDER_KBPS = [150, 300, 600, 1_200, 2_000];

/** Where a call starts before any measurement exists. */
const INITIAL_RUNG = 2;

/** How often getStats is sampled. */
const STATS_INTERVAL_MS = 2_000;

/**
 * Consecutive bad samples before stepping down, and good ones before stepping
 * up.
 *
 * Asymmetric on purpose: dropping quality is cheap and reversible, so it
 * happens after one bad sample, while raising it risks re-triggering the
 * congestion that caused the drop, so it takes a sustained clear run. A
 * symmetric threshold oscillates -- the classic sawtooth where video quality
 * visibly pumps every few seconds, which is more distracting than simply
 * running lower.
 */
const DOWNGRADE_AFTER_BAD = 1;
const UPGRADE_AFTER_GOOD = 4;

/** Loss above this is treated as congestion. */
const LOSS_BAD = 0.05;
/** Round-trip time above this is treated as congestion. */
const RTT_BAD_MS = 400;
/** Below both of these, the link is considered to have headroom. */
const LOSS_GOOD = 0.01;
const RTT_GOOD_MS = 200;

/** How long a disconnected connection is given before an ICE restart. */
const ICE_RESTART_DELAY_MS = 2_000;

export class PeerCall {
  private pc: RTCPeerConnection | null = null;
  private signaling: SignalingClient;
  private localStream: MediaStream | null = null;
  private remoteStream = new MediaStream();
  private displayStream: MediaStream | null = null;

  private polite = false;
  private peerPresent = false;
  private makingOffer = false;
  private ignoreOffer = false;
  private iceServers: ICEServer[] = [];

  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private rung = INITIAL_RUNG;
  private badRun = 0;
  private goodRun = 0;
  private lastSample: { bytesSent: number; bytesReceived: number; at: number } | null = null;

  private state: CallState = "idle";
  private ended = false;

  /** See SignalingClient for `refreshSignalUrl` and `issuedAt`. */
  constructor(
    signalUrl: string,
    private readonly handlers: PeerHandlers = {},
    refreshSignalUrl?: () => Promise<string>,
    issuedAt?: number,
  ) {
    this.signaling = new SignalingClient(signalUrl, {
      onWelcome: (w) => void this.onWelcome(w),
      onPeerJoined: () => void this.onPeerJoined(),
      onPeerLeft: () => this.onPeerLeft(),
      onRoomClosed: (reason) => {
        this.hangUp(`room closed by the server (${reason})`);
        this.handlers.onRoomClosed?.(reason);
      },
      onFrame: (env) => void this.onFrame(env),
      onError: (code, message) => {
        this.log(`signalling error ${code}: ${message}`);
        this.handlers.onError?.(code, message);
      },
      onStateChange: (s) => this.log(`signalling ${s}`),
    }, refreshSignalUrl, issuedAt);
  }

  /** Acquires camera and microphone and connects to the room. */
  async start(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.setState("connecting");
    this.signaling.connect();
    return this.localStream;
  }

  get local(): MediaStream | null {
    return this.localStream;
  }

  get remote(): MediaStream {
    return this.remoteStream;
  }

  sendPointer(pointer: PointerState): boolean {
    return this.signaling.send({ type: FrameType.Pointer, data: pointer });
  }

  sendFileShared(name: string): boolean {
    return this.signaling.send({ type: FrameType.FileShared, data: { name: name.slice(0, 255) } });
  }

  // --- signalling ------------------------------------------------------

  private async onWelcome(w: Welcome): Promise<void> {
    this.polite = w.polite;
    this.peerPresent = w.peerPresent;
    this.iceServers = w.iceServers ?? [];
    this.log(`joined as ${w.peerId} (${w.polite ? "polite" : "impolite"})`);
    this.handlers.onWelcome?.();

    // Rebuilt on every welcome rather than only the first: a welcome after a
    // signalling reconnect means the server may have handed out fresh TURN
    // credentials, and a peer connection holding expired ones cannot restart
    // ICE through the relay.
    this.buildPeerConnection();

    if (this.peerPresent) {
      await this.negotiate();
    } else {
      this.setState("waiting-for-peer");
    }
  }

  private async onPeerJoined(): Promise<void> {
    this.peerPresent = true;
    this.log("peer joined");
    // Only the impolite side offers on arrival. Both offering is precisely the
    // glare the polite/impolite assignment exists to resolve, and resolving it
    // costs a round trip that is avoidable here.
    if (!this.polite) {
      await this.negotiate();
    }
  }

  private onPeerLeft(): void {
    this.peerPresent = false;
    this.log("peer left");
    this.remoteStream.getTracks().forEach((t) => {
      this.remoteStream.removeTrack(t);
    });
    this.setState("waiting-for-peer");
  }

  private async onFrame(env: Envelope): Promise<void> {
    if (env.type === FrameType.StateChanged) {
      this.handlers.onConsultation?.(env.data as Consultation);
      return;
    }
    if (env.type === FrameType.Chat) {
      // Only the server's own chat frames (no `from`) are persisted messages;
      // peer-relayed chat frames are ephemeral and this client sends none.
      if (!env.from && env.data) this.handlers.onMessage?.(env.data as ConsultationMessage);
      return;
    }
    if (env.type === FrameType.Pointer) {
      const pointer = parsePointer(env.data);
      if (pointer) this.handlers.onPointer?.(pointer);
      return;
    }
    if (env.type === FrameType.FileShared) {
      const name = (env.data as { name?: unknown } | undefined)?.name;
      if (typeof name === "string" && name.trim()) this.handlers.onFileShared?.({ name: name.trim() });
      return;
    }

    const pc = this.pc;
    if (!pc) return;

    if (env.type === FrameType.Quality) {
      this.handlers.onRemoteQuality?.(env.data as CallQuality);
      return;
    }
    if (env.type === FrameType.Bye) {
      this.onPeerLeft();
      return;
    }

    try {
      if (env.type === FrameType.Offer || env.type === FrameType.Answer) {
        const description = env.data as RTCSessionDescriptionInit;

        // Perfect negotiation, from the WebRTC spec. A collision is an offer
        // arriving while we have one outstanding; the polite peer rolls its
        // own back and accepts, the impolite peer ignores the incoming one.
        // Without this, two simultaneous offers leave both sides in
        // have-local-offer forever and the call never connects.
        const collision =
          description.type === "offer" && (this.makingOffer || pc.signalingState !== "stable");
        this.ignoreOffer = !this.polite && collision;
        if (this.ignoreOffer) return;

        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          this.signaling.send({ type: FrameType.Answer, data: pc.localDescription?.toJSON() });
        }
        return;
      }

      if (env.type === FrameType.ICE) {
        try {
          await pc.addIceCandidate(env.data as RTCIceCandidateInit);
        } catch (err) {
          // An ICE candidate for an offer we deliberately ignored has nowhere
          // to go, and that is expected rather than a failure.
          if (!this.ignoreOffer) throw err;
        }
      }
    } catch (err) {
      this.log(`negotiation error: ${String(err)}`);
    }
  }

  // --- peer connection --------------------------------------------------

  private buildPeerConnection(): void {
    this.pc?.close();

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers.map((s) => ({
        urls: s.urls,
        username: s.username ?? undefined,
        credential: s.credential ?? undefined,
      })),
      // Pooling warms candidates before the first offer, which shaves a
      // noticeable amount off time-to-first-frame on a slow mobile link.
      iceCandidatePoolSize: 4,
    });
    this.pc = pc;

    this.localStream?.getTracks().forEach((track) => {
      if (this.localStream) pc.addTrack(track, this.localStream);
    });

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!this.remoteStream.getTracks().includes(track)) {
          this.remoteStream.addTrack(track);
        }
      });
      this.handlers.onRemoteStream?.(this.remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({ type: FrameType.ICE, data: event.candidate.toJSON() });
      }
    };

    pc.onnegotiationneeded = () => void this.negotiate();

    pc.onconnectionstatechange = () => {
      this.log(`connection ${pc.connectionState}`);
      switch (pc.connectionState) {
        case "connected":
          this.clearRestartTimer();
          this.setState("connected");
          this.startStats();
          this.applyBitrate();
          break;
        case "disconnected":
          // Not yet failed: "disconnected" is frequently transient -- a
          // handover, a few lost packets -- and restarting ICE immediately
          // tears down a connection that was about to recover on its own. The
          // delay is what separates a blip from a real failure.
          this.setState("reconnecting");
          this.scheduleIceRestart();
          break;
        case "failed":
          this.setState("reconnecting");
          void this.restartIce();
          break;
        case "closed":
          this.stopStats();
          break;
      }
    };
  }

  private async negotiate(): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    try {
      this.makingOffer = true;
      await pc.setLocalDescription();
      this.signaling.send({ type: FrameType.Offer, data: pc.localDescription?.toJSON() });
    } catch (err) {
      this.log(`offer failed: ${String(err)}`);
    } finally {
      this.makingOffer = false;
    }
  }

  private scheduleIceRestart(): void {
    this.clearRestartTimer();
    this.restartTimer = setTimeout(() => {
      if (this.pc?.connectionState === "disconnected") void this.restartIce();
    }, ICE_RESTART_DELAY_MS);
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  /**
   * Rebuilds the media path without dropping the call.
   *
   * restartIce() makes the next offer carry fresh ICE credentials and
   * candidates, so a connection whose network path died -- wifi to cellular,
   * a NAT rebinding, a TURN allocation expiring -- can find a new one while
   * the tracks and the transceivers stay in place.
   *
   * Only the impolite peer drives it, for the same reason it drives the
   * initial offer: two simultaneous restarts collide, and the collision
   * handling would then be resolving a problem nobody needed to create. The
   * polite peer gets its restart when the far side's offer arrives.
   */
  private async restartIce(): Promise<void> {
    const pc = this.pc;
    if (!pc || this.ended) return;
    if (!this.signaling.ready) {
      // No hub connection, no way to deliver a new offer. The signalling client
      // is already reconnecting; this will be driven again by the next state change.
      this.log("ICE restart deferred: signalling is down");
      return;
    }
    if (this.polite) return;

    this.log("restarting ICE");
    pc.restartIce();
    await this.negotiate();
  }

  // --- adaptive bitrate --------------------------------------------------

  private startStats(): void {
    if (this.statsTimer) return;
    this.statsTimer = setInterval(() => void this.sampleStats(), STATS_INTERVAL_MS);
  }

  private stopStats(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private async sampleStats(): Promise<void> {
    const pc = this.pc;
    if (!pc) return;

    const report = await pc.getStats();
    let rttMs: number | null = null;
    let packetsLost = 0;
    let packetsReceived = 0;
    let bytesSent = 0;
    let bytesReceived = 0;
    let frameWidth: number | null = null;
    let frameHeight: number | null = null;
    let relayed = false;

    report.forEach((stat) => {
      if (stat.type === "candidate-pair" && stat.state === "succeeded" && stat.nominated) {
        if (typeof stat.currentRoundTripTime === "number") {
          rttMs = stat.currentRoundTripTime * 1000;
        }
      }
      if (stat.type === "local-candidate" && stat.candidateType === "relay") {
        relayed = true;
      }
      if (stat.type === "outbound-rtp" && stat.kind === "video") {
        bytesSent += stat.bytesSent ?? 0;
        frameWidth = stat.frameWidth ?? frameWidth;
        frameHeight = stat.frameHeight ?? frameHeight;
      }
      if (stat.type === "inbound-rtp" && stat.kind === "video") {
        bytesReceived += stat.bytesReceived ?? 0;
        packetsLost += stat.packetsLost ?? 0;
        packetsReceived += stat.packetsReceived ?? 0;
      }
    });

    const now = Date.now();
    let outboundKbps = 0;
    let inboundKbps = 0;
    if (this.lastSample) {
      const seconds = (now - this.lastSample.at) / 1000;
      if (seconds > 0) {
        outboundKbps = Math.round(((bytesSent - this.lastSample.bytesSent) * 8) / seconds / 1000);
        inboundKbps = Math.round(((bytesReceived - this.lastSample.bytesReceived) * 8) / seconds / 1000);
      }
    }
    this.lastSample = { bytesSent, bytesReceived, at: now };

    const total = packetsLost + packetsReceived;
    const packetLoss = total > 0 ? packetsLost / total : 0;

    const quality: CallQuality = {
      rttMs,
      packetLoss,
      outboundKbps,
      inboundKbps,
      targetKbps: BITRATE_LADDER_KBPS[this.rung] ?? 0,
      frameWidth,
      frameHeight,
      relayed,
    };
    this.handlers.onQuality?.(quality);
    // Sent to the far side so each end can show "their connection is poor"
    // rather than only its own -- which is the difference between a patient
    // apologising for freezing and a doctor knowing to switch to audio.
    this.signaling.send({ type: FrameType.Quality, data: quality });

    this.adapt(packetLoss, rttMs);
  }

  private adapt(loss: number, rttMs: number | null): void {
    const bad = loss > LOSS_BAD || (rttMs !== null && rttMs > RTT_BAD_MS);
    const good = loss < LOSS_GOOD && (rttMs === null || rttMs < RTT_GOOD_MS);

    if (bad) {
      this.badRun += 1;
      this.goodRun = 0;
    } else if (good) {
      this.goodRun += 1;
      this.badRun = 0;
    } else {
      // Neither clearly bad nor clearly good: hold. The dead band between the
      // two thresholds is what stops the ladder hunting around one value.
      this.badRun = 0;
      this.goodRun = 0;
      return;
    }

    if (this.badRun >= DOWNGRADE_AFTER_BAD && this.rung > 0) {
      this.rung -= 1;
      this.badRun = 0;
      this.log(`link degraded, dropping to ${BITRATE_LADDER_KBPS[this.rung]}kbps`);
      this.applyBitrate();
    } else if (this.goodRun >= UPGRADE_AFTER_GOOD && this.rung < BITRATE_LADDER_KBPS.length - 1) {
      this.rung += 1;
      this.goodRun = 0;
      this.log(`link healthy, raising to ${BITRATE_LADDER_KBPS[this.rung]}kbps`);
      this.applyBitrate();
    }
  }

  private applyBitrate(): void {
    const sender = this.pc?.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;

    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      // Some browsers hand back an empty encodings array before the first
      // negotiation completes; setParameters would throw on it.
      params.encodings = [{}];
    }
    const target = (BITRATE_LADDER_KBPS[this.rung] ?? BITRATE_LADDER_KBPS[INITIAL_RUNG] ?? 600) * 1000;
    params.encodings[0]!.maxBitrate = target;
    void sender.setParameters(params).catch((err: unknown) => {
      this.log(`could not apply bitrate: ${String(err)}`);
    });
  }

  // --- controls -----------------------------------------------------------

  setMicrophoneEnabled(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  setCameraEnabled(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  /**
   * Swaps the outbound video track for a screen capture, or back.
   *
   * replaceTrack rather than removing and re-adding: it swaps what the encoder
   * reads without touching the transceiver, so no renegotiation happens and
   * the far side sees the picture change with no interruption.
   */
  async setScreenShare(on: boolean): Promise<MediaStream | null> {
    const sender = this.videoSender();
    if (!sender) throw new Error("Screen sharing is available once the call has connected.");

    if (on) {
      if (this.displayStream) return this.displayStream;
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: true,
      });
      const track = display.getVideoTracks()[0];
      if (!track) {
        display.getTracks().forEach((t) => t.stop());
        return null;
      }
      // The browser's own "stop sharing" control ends the track without going
      // through this method, so the camera has to be restored from the track.
      track.onended = () => {
        if (this.displayStream !== display) return;
        void this.setScreenShare(false).finally(() => this.handlers.onScreenShareEnded?.());
      };
      await sender.replaceTrack(track);
      this.displayStream = display;
      return display;
    }

    const display = this.displayStream;
    this.displayStream = null;
    display?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    const camera = this.localStream?.getVideoTracks()[0];
    if (camera) await sender.replaceTrack(camera);
    return null;
  }

  get screen(): MediaStream | null {
    return this.displayStream;
  }

  private videoSender(): RTCRtpSender | undefined {
    return this.pc
      ?.getTransceivers()
      .find((t) => t.sender.track?.kind === "video" || t.receiver.track?.kind === "video")?.sender;
  }

  private setState(next: CallState): void {
    if (this.state === next) return;
    this.state = next;
    this.handlers.onStateChange?.(next);
  }

  private log(line: string): void {
    this.handlers.onLog?.(line);
  }

  /** Ends the call and releases the camera and microphone. */
  hangUp(reason = "hung up"): void {
    if (this.ended) return;
    this.ended = true;
    this.log(reason);

    this.stopStats();
    this.clearRestartTimer();
    this.signaling.close();
    this.pc?.close();
    this.pc = null;
    this.displayStream?.getTracks().forEach((t) => {
      t.stop();
    });
    this.displayStream = null;
    this.localStream?.getTracks().forEach((t) => {
      t.stop();
    });
    this.setState("ended");
  }
}
