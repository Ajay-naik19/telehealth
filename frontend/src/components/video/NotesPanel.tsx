"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  theme: "light" | "dark";
  peerName: string;
  notes: string;
  medicine: string;
  dosage: string;
  duration: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDownload: () => void;
  onNotesChange: (value: string) => void;
  onMedicineChange: (value: string) => void;
  onDosageChange: (value: string) => void;
  onDurationChange: (value: string) => void;
};

export default function NotesPanel({
  open,
  theme,
  peerName,
  notes,
  medicine,
  dosage,
  duration,
  saving,
  onClose,
  onSave,
  onDownload,
  onNotesChange,
  onMedicineChange,
  onDosageChange,
  onDurationChange,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className={`fixed right-0 top-16 bottom-0 z-35 w-full max-w-md border-l p-4 backdrop-blur-xl ${theme === "dark" ? "border-slate-700 bg-slate-950/70" : "border-slate-300 bg-white/75"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className={theme === "dark" ? "text-base font-semibold text-white" : "text-base font-semibold text-slate-900"}>
                Consultation Notes
              </h2>
              <p className={theme === "dark" ? "text-xs text-slate-300" : "text-xs text-slate-600"}>
                Patient: {peerName}
              </p>
            </div>
            <Button type="button" size="icon" variant="outline" onClick={onClose} className={theme === "dark" ? "h-8 w-8 border-slate-700 bg-slate-900 text-slate-100" : "h-8 w-8 border-slate-300 bg-white text-slate-800"}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Clinical notes, diagnosis and treatment guidance..."
              className={theme === "dark" ? "h-40 w-full resize-none rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-100 outline-none focus:border-blue-500" : "h-40 w-full resize-none rounded-xl border border-slate-300 bg-white/80 p-3 text-sm text-slate-900 outline-none focus:border-blue-500"}
            />

            <div className="grid grid-cols-1 gap-2">
              <input
                value={medicine}
                onChange={(e) => onMedicineChange(e.target.value)}
                placeholder="Medicine name"
                className={theme === "dark" ? "h-10 rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none focus:border-blue-500" : "h-10 rounded-xl border border-slate-300 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-blue-500"}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={dosage}
                  onChange={(e) => onDosageChange(e.target.value)}
                  placeholder="Dosage"
                  className={theme === "dark" ? "h-10 rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none focus:border-blue-500" : "h-10 rounded-xl border border-slate-300 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-blue-500"}
                />
                <input
                  value={duration}
                  onChange={(e) => onDurationChange(e.target.value)}
                  placeholder="Duration"
                  className={theme === "dark" ? "h-10 rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none focus:border-blue-500" : "h-10 rounded-xl border border-slate-300 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-blue-500"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button type="button" onClick={onSave} disabled={saving} className="h-10">
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={onDownload} className="h-10">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
