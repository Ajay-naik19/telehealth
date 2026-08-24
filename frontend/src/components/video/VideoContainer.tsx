"use client";

import { motion } from "framer-motion";
import type { RefObject } from "react";
import VideoTile from "@/components/video/VideoTile";

type Role = "doctor" | "user";

type Props = {
  role: Role;
  theme: "light" | "dark";
  showNotes: boolean;
  selfName: string;
  peerName: string;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  peerVideoOff: boolean;
  isVideoOff: boolean;
};

export default function VideoContainer({
  role,
  theme,
  showNotes,
  selfName,
  peerName,
  localVideoRef,
  remoteVideoRef,
  peerVideoOff,
  isVideoOff,
}: Props) {
  const isDoctor = role === "doctor";

  return (
    <div className="relative h-full w-full px-3 pb-20 pt-18 sm:px-4 md:px-6 md:pb-24">
      <div className={`mx-auto h-full max-h-[calc(100vh-7.5rem)] w-full overflow-hidden rounded-3xl border shadow-2xl ${theme === "dark" ? "border-slate-700/70 bg-slate-900/35" : "border-slate-300/80 bg-white/35"}`}>
        <VideoTile
          videoRef={remoteVideoRef}
          label={role === "doctor" ? peerName : `Dr. ${peerName}`}
          objectFit="contain"
          videoOff={peerVideoOff}
          className="h-full w-full rounded-none border-none"
        />
      </div>

      <motion.div
        drag
        dragMomentum={false}
        className={`absolute z-30 overflow-hidden ${showNotes && isDoctor ? "md:right-108" : "md:right-8"} right-4 top-22 h-24 w-32 rounded-xl md:top-auto md:bottom-30 md:h-40 md:w-60`}
      >
        <VideoTile
          videoRef={localVideoRef}
          label={`You (${selfName})`}
          muted
          mirrored
          videoOff={isVideoOff}
          className="h-full w-full"
        />
      </motion.div>
    </div>
  );
}
