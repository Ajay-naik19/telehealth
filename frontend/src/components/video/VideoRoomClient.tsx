"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { saveConsultationNotes } from "@/lib/api";
import { getSocketTokenFromSession } from "@/services/auth.client";
import { Button } from "@/components/ui/button";
import VideoCallNavbar from "@/components/video/VideoCallNavbar";
import VideoContainer from "@/components/video/VideoContainer";
import ControlsBar from "@/components/video/ControlsBar";
import NotesPanel from "@/components/video/NotesPanel";

type Role = "doctor" | "user";

type Props = {
  role: Role;
  roomId: string;
  appointmentId: number;
  selfName: string;
  peerName: string;
  defaultNotes?: string;
};

type SignalPayload = {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  from?: Role;
};

const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL;
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  if (TURN_URL) {
    const urls = TURN_URL
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length) {
      servers.push({
        urls: urls.length === 1 ? urls[0] : urls,
        username: TURN_USERNAME,
        credential: TURN_CREDENTIAL,
      });
    }
  }

  return servers;
}

const ICE_SERVERS: RTCIceServer[] = buildIceServers();

function resolveSocketUrl() {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (socketUrl && /^https?:\/\//.test(socketUrl)) {
    return socketUrl.replace(/\/$/, "");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && /^https?:\/\//.test(apiUrl)) {
    try {
      const parsed = new URL(apiUrl);
      return parsed.origin;
    } catch {
      return apiUrl.replace(/\/$/, "");
    }
  }

  if (typeof window !== "undefined" && window.location.port === "3000") {
    return `${window.location.protocol}//${window.location.hostname}:10000`;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

async function resolveSocketAuthToken(forceSessionRefresh = false): Promise<string | null> {
  try {
    // Socket auth is cookie-first; token is optional and fetched dynamically from session when available.
    const token = await getSocketTokenFromSession();
    if (token && token.length > 20) {
      return token;
    }
  } catch {
    // Ignore token lookup failures and fall back to cookie-based auth.
  }

  return null;
}

export default function VideoRoomClient({
  role,
  roomId,
  appointmentId,
  selfName,
  peerName,
  defaultNotes = "",
}: Props) {
  const router = useRouter();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const creatingOfferRef = useRef(false);
  const authRetryAttemptedRef = useRef(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [peerMuted, setPeerMuted] = useState(false);
  const [peerVideoOff, setPeerVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState("Connecting secure call...");
  const [peerConnected, setPeerConnected] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(defaultNotes);
  const [medicine, setMedicine] = useState("");
  const [dosage, setDosage] = useState("");
  const [duration, setDuration] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [endingCall, setEndingCall] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  const roleLabel = role === "doctor" ? "doctor" : "patient";
  const dashboardPath = role === "doctor" ? "/doctor/video/dashboard" : "/patient/video/dashboard";

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial: "light" | "dark" =
      saved === "light" || saved === "dark"
        ? saved
        : "light";

    document.documentElement.classList.toggle("dark", initial === "dark");
    localStorage.setItem("theme", initial);
    setTheme(initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  const cleanupConnection = useCallback(() => {
    const socket = socketRef.current;
    const pc = pcRef.current;

    socket?.removeAllListeners();
    socket?.disconnect();
    socketRef.current = null;

    pc?.close();
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    remoteStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const emitSignal = useCallback((payload: SignalPayload) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("signal", { roomId, ...payload });
  }, [roomId]);

  const flushPendingIceCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;

    const queued = pendingIceCandidatesRef.current;
    if (!queued.length) return;

    pendingIceCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale candidates from older negotiation rounds.
      }
    }
  }, []);

  const createOffer = useCallback(async (iceRestart = false) => {
    if (role !== "doctor") return;
    const pc = pcRef.current;
    if (!pc || creatingOfferRef.current) return;

    if (pc.signalingState !== "stable" && !iceRestart) {
      return;
    }

    try {
      creatingOfferRef.current = true;
      const offer = await pc.createOffer({ iceRestart });
      await pc.setLocalDescription(offer);
      emitSignal({ sdp: offer });
      setCallStatus("Calling participant...");
    } catch {
      toast.error("Failed to create a secure connection offer.");
    } finally {
      creatingOfferRef.current = false;
    }
  }, [emitSignal, role]);

  const handleSignal = useCallback(async (payload: SignalPayload) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      if (payload.sdp) {
        if (payload.sdp.type === "answer" && pc.signalingState !== "have-local-offer") {
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushPendingIceCandidates();

        if (payload.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitSignal({ sdp: answer });
          setCallStatus("Secure channel established.");
        }
      }

      if (payload.candidate) {
        if (!pc.remoteDescription) {
          pendingIceCandidatesRef.current.push(payload.candidate);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    } catch {
      toast.error("WebRTC signaling failed. Reconnecting...");
    }
  }, [emitSignal, flushPendingIceCandidates]);

  const setupPeerConnection = useCallback((localStream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];
      if (incomingStream) {
        remoteStreamRef.current = incomingStream;
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== incomingStream) {
          remoteVideoRef.current.srcObject = incomingStream;
          remoteVideoRef.current.play().catch(() => {});
        }
      }
      setPeerConnected(true);
      setCallStatus("Connected");
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitSignal({ candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setPeerConnected(true);
        setCallStartedAt(Date.now());
        toast.success("Secure call connected.");
        setCallStatus("Connected");
      }

      if (state === "disconnected") {
        setCallStatus("Connection interrupted...");
        toast.warning("Connection interrupted. Reconnecting...");
      }

      if (state === "failed" && role === "doctor") {
        toast.error("Connection failed. Restarting call negotiation...");
        createOffer(true).catch(() => {});
      }
    };
  }, [createOffer, emitSignal, role]);

  useEffect(() => {
    mountedRef.current = true;

    const run = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!mountedRef.current) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        setupPeerConnection(localStream);

        const authToken = await resolveSocketAuthToken();
        const socket = io(resolveSocketUrl(), {
          transports: ["websocket", "polling"],
          withCredentials: true,
          timeout: 15000,
          auth: authToken ? { token: authToken } : undefined,
        });
        socketRef.current = socket;

        console.info("[video-debug] socket init", {
          role,
          roomId,
          socketUrl: resolveSocketUrl(),
          hasAuthToken: Boolean(authToken),
          apiBase: process.env.NEXT_PUBLIC_API_URL || "/backend",
          origin: typeof window !== "undefined" ? window.location.origin : "server",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        });

        socket.on("connect", () => {
          authRetryAttemptedRef.current = false;
          console.info("[video-debug] socket connected", {
            socketId: socket.id,
            role,
            roomId,
          });
          socket.emit("join-room", { roomId, role });
          setCallStatus("Joined secure room");
        });

        socket.on("connect_error", (error) => {
          console.error("[video-debug] socket connect_error", {
            role,
            roomId,
            socketUrl: resolveSocketUrl(),
            message: error?.message,
            name: error?.name,
            description: (error as Error & { description?: unknown })?.description,
            context: (error as Error & { context?: unknown })?.context,
            data: (error as Error & { data?: unknown })?.data,
            stack: error?.stack,
          });
          const message = error?.message?.toLowerCase() || "";
          if (message.includes("authentication") || message.includes("token") || message.includes("expired")) {
            if (!authRetryAttemptedRef.current) {
              authRetryAttemptedRef.current = true;
              resolveSocketAuthToken(true)
                .then((freshToken) => {
                  if (!freshToken || !socketRef.current) return;
                  socketRef.current.auth = { token: freshToken };
                  socketRef.current.connect();
                })
                .catch(() => {});
            }
            toast.error("Video auth failed. Please log in again and reopen the room.");
          } else if (message.includes("cors")) {
            toast.error("Socket CORS blocked. Verify frontend URL is allowed on backend.");
          } else {
            toast.error("Signal server not reachable. Reconnecting...");
          }
          setCallStatus("Reconnecting securely...");
        });

        socket.on("doctor-joined", (payload: { message?: string }) => {
          setCallStatus(payload?.message || "Doctor joined room");
          if (role === "doctor" && payload?.message?.toLowerCase().includes("ready")) {
            createOffer().catch(() => {});
          }
        });

        socket.on("user-joined", (payload: { message?: string }) => {
          setCallStatus(payload?.message || "Patient joined room");
        });

        socket.on("user-ready", () => {
          setPeerConnected(true);
          setCallStatus("Patient is ready");
          if (role === "doctor") {
            createOffer().catch(() => {});
          }
        });

        socket.on("doctor-ready", () => {
          setPeerConnected(true);
          setCallStatus("Doctor is ready");
          if (role === "user") {
            socket.emit("user-ready-ack", { roomId });
          }
        });

        socket.on("user-ready-ack", () => {
          if (role === "doctor") {
            createOffer().catch(() => {});
          }
        });

        socket.on("signal", (payload: SignalPayload) => {
          handleSignal(payload).catch(() => {});
        });

        socket.on("participant-mute-state", (payload: { role: Role; isMuted: boolean }) => {
          if (payload.role !== role) {
            setPeerMuted(Boolean(payload.isMuted));
          }
        });

        socket.on("user-mute-state", (payload: { isMuted: boolean }) => {
          if (role === "doctor") setPeerMuted(Boolean(payload.isMuted));
        });

        socket.on("doctor-mute-state", (payload: { isMuted: boolean }) => {
          if (role === "user") setPeerMuted(Boolean(payload.isMuted));
        });

        socket.on("participant-camera-state", (payload: { role: Role; isVideoOff: boolean }) => {
          if (payload.role !== role) {
            setPeerVideoOff(Boolean(payload.isVideoOff));
          }
        });

        socket.on("user-camera-state", (payload: { isVideoOff: boolean }) => {
          if (role === "doctor") setPeerVideoOff(Boolean(payload.isVideoOff));
        });

        socket.on("doctor-camera-state", (payload: { isVideoOff: boolean }) => {
          if (role === "user") setPeerVideoOff(Boolean(payload.isVideoOff));
        });

        socket.on("participant-disconnected", (payload: { role: Role; graceMs?: number }) => {
          const name = payload.role === "doctor" ? "doctor" : "patient";
          const seconds = Math.round((payload.graceMs || 30000) / 1000);
          toast.warning(`The ${name} disconnected. Waiting up to ${seconds}s for reconnection...`);
          setCallStatus("Peer disconnected");
        });

        socket.on("user-disconnected", () => {
          if (role === "doctor") {
            toast.warning("Patient disconnected. Waiting for reconnection...");
            setCallStatus("Peer disconnected");
          }
        });

        socket.on("doctor-disconnected", () => {
          if (role === "user") {
            toast.warning("Doctor disconnected. Waiting for reconnection...");
            setCallStatus("Peer disconnected");
          }
        });

        socket.on("participant-reconnected", (payload: { role: Role }) => {
          const name = payload.role === "doctor" ? "Doctor" : "Patient";
          toast.success(`${name} reconnected`);
          if (role === "doctor") {
            createOffer(true).catch(() => {});
          }
        });

        socket.on("participant-left", (payload: { role: Role; permanent: boolean }) => {
          if (payload.permanent) {
            setCallStatus("Peer left permanently");
            toast.error("The other participant has left the call.");
          }
        });

        socket.on("ice-restart-needed", () => {
          if (role === "doctor") {
            createOffer(true).catch(() => {});
          }
        });

        socket.on("call-ended-by-doctor", () => {
          if (role === "user") {
            toast.info("Doctor ended the consultation. You can download your prescription.");
            setCallStatus("Consultation ended");
            setPeerConnected(false);
            setShowPrescriptionModal(true);
            cleanupConnection();
          }
        });

        socket.on("call-ended-confirmed", () => {
          if (role === "doctor") {
            toast.success("Call ended successfully.");
            cleanupConnection();
            router.replace("/doctor/video/dashboard");
          }
        });

        socket.on("error", (payload: { message?: string }) => {
          console.error("[video-debug] socket error event", {
            role,
            roomId,
            payload,
          });
          toast.error(payload?.message || "Video room error");
        });
      } catch {
        toast.error("Camera and microphone access is required for video consultation.");
        router.replace(`/${role === "doctor" ? "doctor" : "patient"}/video/setup/${roomId}`);
      }
    };

    run().catch(() => {});

    return () => {
      mountedRef.current = false;
      cleanupConnection();
    };
  }, [cleanupConnection, createOffer, handleSignal, role, roomId, router, setupPeerConnection]);

  const handleToggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
    socketRef.current?.emit("mute-state", { roomId, isMuted: nextMuted });
  };

  const handleToggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const nextVideoOff = !isVideoOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !nextVideoOff;
    });

    setIsVideoOff(nextVideoOff);
    socketRef.current?.emit("camera-state", { roomId, isVideoOff: nextVideoOff });
  };

  const handleToggleSpeaker = () => {
    const next = !isSpeakerOff;
    setIsSpeakerOff(next);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = next;
    }
  };

  const saveNotes = async () => {
    if (role !== "doctor") return;
    setSavingNotes(true);
    try {
      const compiled = [
        notes.trim(),
        medicine.trim() ? `Medicine: ${medicine.trim()}` : "",
        dosage.trim() ? `Dosage: ${dosage.trim()}` : "",
        duration.trim() ? `Duration: ${duration.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await saveConsultationNotes(roomId, compiled || notes);
      toast.success("Consultation notes saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save notes.";
      toast.error(message);
    } finally {
      setSavingNotes(false);
    }
  };

  const downloadConsultationSummary = () => {
    fetch(`${API_BASE}/api/prescription/download/${roomId}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/pdf",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          let message = "Unable to download prescription PDF.";
          try {
            const payload = (await response.json()) as { message?: string; error?: string };
            message = payload?.message || payload?.error || message;
          } catch {
            // Ignore parse errors, keep default message.
          }
          throw new Error(message);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Prescription_${roomId.slice(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to download prescription PDF.";
        toast.error(message);
      });
  };

  useEffect(() => {
    if (!callStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [callStartedAt]);

  const timerText = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
    const secs = (elapsedSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }, [elapsedSeconds]);

  const endCallAsDoctor = async () => {
    if (role !== "doctor") return;
    setEndingCall(true);

    try {
      socketRef.current?.emit("doctor-end-call", {
        roomId,
        appointmentId,
        notes,
      });
      toast.info("Ending call...");
    } catch {
      toast.error("Unable to end call right now.");
      setEndingCall(false);
    }
  };

  const leaveRoom = () => {
    cleanupConnection();
    router.replace(dashboardPath);
  };

  const isDoctor = role === "doctor";

  const baseShell =
    theme === "dark"
      ? "h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
      : "h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-white text-slate-900";

  return (
    <div className={baseShell}>
      <div className="relative h-screen overflow-hidden">
        <VideoCallNavbar
          role={role}
          peerName={peerName}
          callStatus={callStatus}
          peerConnected={peerConnected}
          theme={theme}
          timerText={timerText}
          onToggleTheme={toggleTheme}
        />

        <VideoContainer
          role={role}
          theme={theme}
          showNotes={showNotes}
          selfName={selfName}
          peerName={peerName}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          peerVideoOff={peerVideoOff}
          isVideoOff={isVideoOff}
        />

        <ControlsBar
          role={role}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSpeakerOff={isSpeakerOff}
          showNotes={showNotes}
          theme={theme}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onToggleSpeaker={handleToggleSpeaker}
          onToggleNotes={() => setShowNotes((prev) => !prev)}
          onLeave={leaveRoom}
          onEndCall={endCallAsDoctor}
          endingCall={endingCall}
        />

        {isDoctor && (
          <NotesPanel
            open={showNotes}
            theme={theme}
            peerName={peerName}
            notes={notes}
            medicine={medicine}
            dosage={dosage}
            duration={duration}
            saving={savingNotes}
            onClose={() => setShowNotes(false)}
            onSave={saveNotes}
            onDownload={downloadConsultationSummary}
            onNotesChange={setNotes}
            onMedicineChange={setMedicine}
            onDosageChange={setDosage}
            onDurationChange={setDuration}
          />
        )}

        {role === "user" && showPrescriptionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
            <div
              className={
                theme === "dark"
                  ? "w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
                  : "w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl"
              }
            >
              <h3 className={theme === "dark" ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>
                Consultation Completed
              </h3>
              <p className={theme === "dark" ? "mt-2 text-sm text-slate-300" : "mt-2 text-sm text-slate-600"}>
                Your call has ended. Download prescription of this call.
              </p>
              <p className={theme === "dark" ? "mt-2 text-sm text-emerald-300" : "mt-2 text-sm text-emerald-700"}>
                Buy all your medicines from our pharmacy.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="button" onClick={downloadConsultationSummary}>
                  Download Prescription
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowPrescriptionModal(false);
                    router.push("/pharmacy");
                  }}
                >
                  Go to Pharmacy
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => {
                  setShowPrescriptionModal(false);
                  router.push("/patient/video/dashboard");
                }}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
