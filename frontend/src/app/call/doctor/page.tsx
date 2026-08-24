"use client";

import { useEffect, useRef, useState } from "react";
import { Dot, FileText, FileX, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import Navbar from "@/components/Navbar";
import CallTimer from "@/components/call/CallTimer";
import ControlButton from "@/components/call/ControlButton";
import EndCallModal from "@/components/call/EndCallModal";
import LocalVideoPanel from "@/components/call/LocalVideoPanel";
import NotesPanel from "@/components/call/NotesPanel";

type PrescriptionRow = {
  medicine: string;
  dosage: string;
  duration: string;
};

export default function DoctorCallPage() {
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isRecording] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [showEndModal, setShowEndModal] = useState(false);

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionRow[]>([
    { medicine: "", dosage: "", duration: "" },
  ]);

  const [hasRemoteVideo] = useState(false);
  const [hasLocalVideo] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;

    let hideTimer: number | null = null;

    const showAndScheduleHide = () => {
      setShowControls(true);
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    showAndScheduleHide();

    host.addEventListener("mousemove", showAndScheduleHide);
    host.addEventListener("touchstart", showAndScheduleHide, { passive: true });

    return () => {
      host.removeEventListener("mousemove", showAndScheduleHide);
      host.removeEventListener("touchstart", showAndScheduleHide);
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
    };
  }, []);

  const onPrescriptionChange = (index: number, key: keyof PrescriptionRow, value: string) => {
    setPrescriptionRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const addMedicine = () => {
    setPrescriptionRows((prev) => [...prev, { medicine: "", dosage: "", duration: "" }]);
  };

  const endAppointment = () => {
    setShowEndModal(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="border-b border-border bg-card/60 px-4 py-3">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            Arjun Mehta · 34 yrs · #PT-00412
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
              Video Consultation
            </span>
            {isRecording && (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Dot className="h-4 w-4 animate-pulse text-red-500" />
                Rec
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="relative bg-zinc-950">
        <div ref={canvasRef} className={`relative h-[calc(100vh-8.5rem)] w-full overflow-hidden transition-all duration-300 ${isNotesOpen ? "md:pr-[40vw]" : "md:pr-0"}`}>
          {hasRemoteVideo ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-linear-to-br from-zinc-700 to-zinc-900">
              <div className="flex h-18 w-18 items-center justify-center rounded-full bg-zinc-800 text-xl font-semibold text-white">
                AM
              </div>
              <p className="mt-3 text-sm font-medium text-white">Arjun Mehta</p>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/70 to-transparent" />

          <div className="absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Connected · HD
          </div>

          <CallTimer seconds={seconds} />

          <LocalVideoPanel label="You" videoRef={localVideoRef} showVideo={hasLocalVideo} />

          <div className={`absolute bottom-4 left-1/2 z-30 -translate-x-1/2 transition-all duration-300 ${showControls ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-xl">
              <ControlButton
                icon={isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                label="Mic"
                title="Toggle microphone"
                onClick={() => setIsMuted((prev) => !prev)}
                active={!isMuted}
                muted={isMuted}
                iconOnlyOnMobile
              />

              <ControlButton
                icon={isCameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                label="Camera"
                title="Toggle camera"
                onClick={() => setIsCameraOff((prev) => !prev)}
                active={!isCameraOff}
                muted={isCameraOff}
                iconOnlyOnMobile
              />

              <ControlButton
                icon={isNotesOpen ? <FileX className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                label="Notes"
                title="Toggle notes panel"
                onClick={() => setIsNotesOpen((prev) => !prev)}
                active={isNotesOpen}
                iconOnlyOnMobile
              />

              <span className="mx-1 h-6 w-px bg-white/20" />

              <ControlButton
                icon={<PhoneOff className="h-4 w-4" />}
                label="End Call"
                title="End appointment for both"
                onClick={() => setShowEndModal(true)}
                danger
              />
            </div>
          </div>
        </div>

        <NotesPanel
          open={isNotesOpen}
          chiefComplaint={chiefComplaint}
          clinicalNotes={clinicalNotes}
          followUpDate={followUpDate}
          followUpNotes={followUpNotes}
          prescriptionRows={prescriptionRows}
          onClose={() => setIsNotesOpen(false)}
          onChiefComplaintChange={setChiefComplaint}
          onClinicalNotesChange={setClinicalNotes}
          onFollowUpDateChange={setFollowUpDate}
          onFollowUpNotesChange={setFollowUpNotes}
          onPrescriptionChange={onPrescriptionChange}
          onAddMedicine={addMedicine}
          onSaveDraft={() => {}}
          onSendToPatient={() => {}}
        />

        <EndCallModal open={showEndModal} onCancel={() => setShowEndModal(false)} onConfirm={endAppointment} />
      </section>
    </main>
  );
}
