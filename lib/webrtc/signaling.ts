/**
 * Client half of the consultation signalling hub (SignalR, /hubs/consultation).
 *
 * It carries SDP and ICE between the two browsers plus the server's own
 * frames (state changes, persisted chat, room closure). Once the peer
 * connection is up this connection is mostly idle, and losing it does not drop
 * the call. It is only fatal if the media path also needs renegotiating, which
 * is exactly when the ICE restart in peer.ts wants it back.
 */

import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";

export type Envelope = {
  type: string;
  from?: string | null;
  data?: unknown;
};

export type ICEServer = {
  urls: string[];
  username?: string | null;
  credential?: string | null;
};

export type Welcome = {
  peerId: string;
  role: "patient" | "doctor";
  /**
   * Which side yields when both offer at once. Assigned by the server, never
   * negotiated between clients.
   */
  polite: boolean;
  peerPresent: boolean;
  iceServers: ICEServer[];
};

export const FrameType = {
  Offer: "offer",
  Answer: "answer",
  ICE: "ice",
  Bye: "bye",
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
  StateChanged: "state-changed",
  Error: "error",
} as const;

/** room-closed reason when the same user connected again elsewhere. */
export const ROOM_REPLACED = "replaced";

export type SignalingState = "connecting" | "open" | "reconnecting" | "closed";

export type SignalingHandlers = {
  onWelcome?: (w: Welcome) => void;
  onPeerJoined?: () => void;
  onPeerLeft?: () => void;
  onRoomClosed?: (reason: string) => void;
  onFrame?: (env: Envelope) => void;
  onStateChange?: (state: SignalingState) => void;
  onError?: (code: string, message: string) => void;
};

/**
 * Room tokens last about ten minutes and are only checked when a connection
 * opens. Past this age a token is not trusted for a reconnect: the server
 * rejects an expired one in a way SignalR will not retry, so a fresh one is
 * fetched first.
 */
const TOKEN_REUSE_MS = 8 * 60_000;

/** SignalR's own reconnect attempts, for short drops while the token is fresh. */
const RECONNECT_MS = [0, 2_000, 5_000, 10_000];

/** Delay between fresh-token restarts once SignalR has given up. */
const RESTART_MS = [1_000, 2_000, 4_000, 8_000];

export class SignalingClient {
  private readonly connection: HubConnection;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private closedByUs = false;
  private roomClosed = false;
  private state: SignalingState = "closed";

  /**
   * `url` is the absolute hub URL including `?roomToken=`. `refreshUrl`
   * returns one with a fresh token (by joining again); `issuedAt` is when the
   * token in `url` was issued.
   */
  constructor(
    private url: string,
    private readonly handlers: SignalingHandlers = {},
    private readonly refreshUrl?: () => Promise<string>,
    private issuedAt = Date.now(),
  ) {
    this.connection = new HubConnectionBuilder()
      // The API's default CORS policy does not allow credentials, and the room
      // token in the URL is the only credential the hub reads.
      .withUrl(url, { withCredentials: false })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: ({ previousRetryCount }) =>
          this.stale() ? null : (RECONNECT_MS[previousRetryCount] ?? null),
      })
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.on("frame", (env: Envelope) => this.dispatch(env));
    this.connection.onreconnecting(() => this.setState("reconnecting"));
    this.connection.onreconnected(() => this.setState("open"));
    this.connection.onclose(() => {
      if (this.closedByUs || this.roomClosed) {
        this.setState("closed");
        return;
      }
      this.scheduleRestart();
    });
  }

  connect(): void {
    this.closedByUs = false;
    this.roomClosed = false;
    this.setState("connecting");
    void this.open();
  }

  private stale(): boolean {
    return Boolean(this.refreshUrl) && Date.now() - this.issuedAt > TOKEN_REUSE_MS;
  }

  private async open(): Promise<void> {
    try {
      if (this.stale()) {
        this.url = await this.refreshUrl!();
        this.issuedAt = Date.now();
      }
      if (this.closedByUs) return;
      this.connection.baseUrl = this.url;
      await this.connection.start();
      this.attempt = 0;
      this.setState("open");
    } catch {
      if (!this.closedByUs && !this.roomClosed) this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    const delay = RESTART_MS[Math.min(this.attempt, RESTART_MS.length - 1)] ?? 8_000;
    this.attempt += 1;
    this.setState("reconnecting");
    this.retryTimer = setTimeout(() => void this.open(), delay);
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
      case FrameType.RoomClosed: {
        // The server aborts the connection right after this frame. Retrying
        // into a replaced or ended room would fight whatever replaced us.
        this.roomClosed = true;
        const reason = (env.data as { reason?: string } | undefined)?.reason ?? "";
        this.handlers.onRoomClosed?.(reason);
        return;
      }
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

  private setState(next: SignalingState): void {
    if (this.state === next) return;
    this.state = next;
    this.handlers.onStateChange?.(next);
  }

  /** True when a frame can be sent right now. */
  get ready(): boolean {
    return this.connection.state === HubConnectionState.Connected;
  }

  /**
   * Sends a frame, returning false when the connection is not open.
   *
   * Frames are dropped rather than queued: an SDP or ICE candidate that
   * arrives after a reconnect describes a negotiation that no longer exists.
   * The recovery for a lost frame is an ICE restart, which produces fresh ones.
   */
  send(env: Envelope): boolean {
    if (!this.ready) return false;
    void this.connection.invoke("Send", { type: env.type, data: env.data }).catch(() => undefined);
    return true;
  }

  close(): void {
    this.closedByUs = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const stop = () => void this.connection.stop();
    if (this.ready) {
      void this.connection
        .invoke("Send", { type: FrameType.Bye })
        .catch(() => undefined)
        .finally(stop);
    } else {
      stop();
    }
    this.setState("closed");
  }
}
