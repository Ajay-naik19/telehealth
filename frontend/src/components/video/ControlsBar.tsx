"use client";

import { motion } from "framer-motion";
import { Camera, CameraOff, FileText, Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";

type Role = "doctor" | "user";

type Props = {
  role: Role;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOff: boolean;
  showNotes: boolean;
  theme: "light" | "dark";
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onToggleNotes: () => void;
  onLeave: () => void;
  onEndCall: () => void;
  endingCall: boolean;
};

type IconButtonProps = {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  theme: "light" | "dark";
};

function IconButton({ active = false, danger = false, onClick, children, ariaLabel, theme }: IconButtonProps) {
  const className = danger
    ? "border-rose-500/70 bg-rose-500 text-white shadow-rose-500/30"
    : active
      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
      : theme === "dark"
        ? "border-slate-600 bg-slate-800/80 text-slate-100"
        : "border-slate-300 bg-white/90 text-slate-800";

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 md:h-11 md:w-11 ${className}`}
    >
      {children}
    </motion.button>
  );
}

export default function ControlsBar({
  role,
  isMuted,
  isVideoOff,
  isSpeakerOff,
  showNotes,
  theme,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onToggleNotes,
  onLeave,
  onEndCall,
  endingCall,
}: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
      <div className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-2 shadow-2xl backdrop-blur-xl md:px-4 ${theme === "dark" ? "border-slate-700/80 bg-slate-900/70" : "border-slate-300/90 bg-white/85"}`}>
        <IconButton
          theme={theme}
          active={!isMuted}
          onClick={onToggleMute}
          ariaLabel={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-4 w-4 text-rose-200" /> : <Mic className="h-4 w-4" />}
        </IconButton>

        <IconButton
          theme={theme}
          active={!isVideoOff}
          onClick={onToggleVideo}
          ariaLabel={isVideoOff ? "Turn video on" : "Turn video off"}
        >
          {isVideoOff ? <CameraOff className="h-4 w-4 text-rose-200" /> : <Camera className="h-4 w-4" />}
        </IconButton>

        <IconButton
          theme={theme}
          active={!isSpeakerOff}
          onClick={onToggleSpeaker}
          ariaLabel={isSpeakerOff ? "Turn speaker on" : "Turn speaker off"}
        >
          {isSpeakerOff ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </IconButton>

        {role === "doctor" && (
          <IconButton
            theme={theme}
            active={showNotes}
            onClick={onToggleNotes}
            ariaLabel={showNotes ? "Hide notes" : "Show notes"}
          >
            <FileText className="h-4 w-4" />
          </IconButton>
        )}

        {role === "doctor" ? (
          <IconButton
            theme={theme}
            danger
            onClick={onEndCall}
            ariaLabel={endingCall ? "Ending call" : "End call"}
          >
            <PhoneOff className="h-4 w-4" />
          </IconButton>
        ) : (
          <IconButton
            theme={theme}
            onClick={onLeave}
            ariaLabel="Leave call"
          >
            <PhoneOff className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
