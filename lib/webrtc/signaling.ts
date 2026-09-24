/**
 * Client half of the platform's own signalling protocol.
 *
 * Mirrors internal/domain/consultation/signal on the Go side: same frame
 * types, same allowlist, same two-peer assumption. It carries SDP and ICE
 * between the two browsers and nothing else -- once the peer connection is up,
 * this socket is idle apart from keepalives, and losing it does not drop the
 * call. That last point is the reason reconnection here is unhurried: a
 * dropped signalling socket is only fatal if the media path also needs
 * renegotiating, which is exactly when the ICE restart in peer.ts wants it
 * back.
 */

export type Envelope = {
  type: string;
  from?: string;
  data?: unknown;
};

export type ICEServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

export type Welcome = {
  peer_id: string;
  room: string;
  /**
   * Which side yields when both offer at once. Assigned by the server, never
   * negotiated between clients -- see the Go side for why.
   */
  polite: boolean;
  peer_present: boolean;
  ice_servers: ICEServer[];
};

export const FrameType = {
  Offer: "offer",
  Answer: "answer",
  ICE: "ice",
  Bye: "bye",
  RecordingState: "recording-state",
  Quality: "quality",
  Chat: "chat",
  Pointer: "pointer",
  FileShared: "file_shared",
  Ping: "ping",
  Pong: "pong",
  Welcome: "welcome",
  PeerJoined: "peer-joined",
  PeerLeft: "peer-left",
  RoomClosed: "room-closed",
  Error: "error",
} as const;

export type SignalingState = "connecting" | "open" | "reconnecting" | "closed";

export type SignalingHandlers = {
  onWelcome?: (w: Welcome) => void;
  onPeerJoined?: () => void;
  onPeerLeft?: () => void;
  onRoomClosed?: () => void;
  onFrame?: (env: Envelope) => void;
  onStateChange?: (state: SignalingState) => void;
  onError?: (code: string, message: string) => void;
};

/** Milliseconds between application-level pings. */
const PING_INTERVAL = 20_000;

/**
 * Reconnect backoff, in milliseconds, indexed by consecutive attempt.
 *
 * It starts fast because the common case is a two-second mobile handover and
 * the user is mid-sentence, and it tops out rather than growing without bound
 * because a consultation that has been unreachable for half a minute needs a
 * person to decide what happens next, not a client quietly retrying for an
 * hour.
 */
const BACKOFF_MS = [250, 500, 1_000, 2_000, 4_000, 8_000];

export class SignalingClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private closedByUs = false;
  private state: SignalingState = "closed";

  constructor(
    private readonly url: string,
    private readonly handlers: SignalingHandlers = {},
  ) {}

  connect(): void {
    this.closedByUs = false;
    this.open();
  }

  private open(): void {
    this.setState(this.attempt === 0 ? "connecting" : "reconnecting");

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.setState("open");
      this.pingTimer = setInterval(() => {
        this.send({ type: FrameType.Ping });
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      let env: Envelope;
      try {
        env = JSON.parse(event.data as string) as Envelope;
      } catch {
        return;
      }
      this.dispatch(env);
    };

    ws.onclose = (event) => {
      this.clearTimers();
      if (this.closedByUs) {
        this.setState("closed");
        return;
      }
      // A normal close is the server saying it is finished with this peer --
      // the room closed, or another socket took over this identity. Retrying
      // into that would fight whatever replaced us, so only abnormal closes
      // are retried.
      if (event.code === 1000) {
        this.setState("closed");
        return;
      }
      this.scheduleRetry();
    };

    ws.onerror = () => {
      // Deliberately empty. An error is always followed by a close, and the
      // close handler owns the retry decision; acting here as well would
      // double-schedule it.
    };
  }

  private dispatch(env: Envelope): void {
    switch (env.type) {
      case FrameType.Welcome:
        this.handlers.onWelcome?.(env.data as Welcome);
        return;
      case FrameType.PeerJoined:
        this.handlers.onPeerJoined?.();
        return;
      case FrameType.PeerLeft:
        this.handlers.onPeerLeft?.();
        return;
      case FrameType.RoomClosed:
        this.handlers.onRoomClosed?.();
        return;
      case FrameType.Pong:
        return;
      case FrameType.Error: {
        const data = env.data as { code?: string; message?: string } | undefined;
        this.handlers.onError?.(data?.code ?? "ERROR", data?.message ?? "signalling error");
        return;
      }
      default:
        this.handlers.onFrame?.(env);
    }
  }

  private scheduleRetry(): void {
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)] ?? 8_000;
    this.attempt += 1;
    this.setState("reconnecting");
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private setState(next: SignalingState): void {
    if (this.state === next) return;
    this.state = next;
    this.handlers.onStateChange?.(next);
  }

  /** True when a frame can be sent right now. */
  get ready(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Sends a frame, returning false when the socket is not open.
   *
   * Frames are dropped rather than queued, and that is correct for this
   * protocol: an SDP or ICE candidate that arrives after a reconnect describes
   * a negotiation that no longer exists, and replaying it confuses the far
   * side rather than helping it. The recovery for a lost frame is an ICE
   * restart, which produces fresh ones.
   */
  send(env: Envelope): boolean {
    if (!this.ready) return false;
    this.ws?.send(JSON.stringify(env));
    return true;
  }

  close(): void {
    this.closedByUs = true;
    this.clearTimers();
    this.send({ type: FrameType.Bye });
    this.ws?.close(1000, "client closed");
    this.ws = null;
    this.setState("closed");
  }
}
