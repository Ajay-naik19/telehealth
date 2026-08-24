"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import VideoRoomClient from "@/components/video/VideoRoomClient";
import { getPatientVideoRoom } from "@/lib/api";

type PatientRoomInfo = {
  roomId: string;
  appointmentId: number;
  userId: number;
  userName: string;
  doctorName: string;
  userRole: "user";
};

export default function PatientVideoRoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params.roomId;

  const [loading, setLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState<PatientRoomInfo | null>(null);

  useEffect(() => {
    const setupKey = `videoSetup:patient:${roomId}`;
    const setupDone = typeof window !== "undefined" ? localStorage.getItem(setupKey) : null;

    if (!setupDone) {
      toast.info("Run device and network checks before joining the room.");
      router.replace(`/patient/video/setup/${roomId}`);
      return;
    }

    getPatientVideoRoom(roomId)
      .then((data) => {
        setRoomInfo(data as PatientRoomInfo);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to validate video room.";
        toast.error(message);
        router.replace("/patient/video/dashboard");
      })
      .finally(() => setLoading(false));
  }, [roomId, router]);

  if (loading || !roomInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-400" />
          <p className="mt-3 text-sm">Validating secure room access...</p>
        </div>
      </div>
    );
  }

  if (!roomInfo.appointmentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-2xl border border-rose-700/60 bg-rose-900/30 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-rose-300" />
          <h2 className="mt-3 text-lg font-semibold">Room verification failed</h2>
          <p className="mt-2 text-sm text-rose-100/80">
            This room is unavailable or has already ended.
          </p>
        </div>
      </div>
    );
  }

  return (
    <VideoRoomClient
      role="user"
      roomId={roomInfo.roomId}
      appointmentId={roomInfo.appointmentId}
      selfName={roomInfo.userName || "Patient"}
      peerName={roomInfo.doctorName || "Doctor"}
    />
  );
}
