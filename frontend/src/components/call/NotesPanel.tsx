"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type PrescriptionRow = {
  medicine: string;
  dosage: string;
  duration: string;
};

type NotesPanelProps = {
  open: boolean;
  chiefComplaint: string;
  clinicalNotes: string;
  followUpDate: string;
  followUpNotes: string;
  prescriptionRows: PrescriptionRow[];
  onClose: () => void;
  onChiefComplaintChange: (value: string) => void;
  onClinicalNotesChange: (value: string) => void;
  onFollowUpDateChange: (value: string) => void;
  onFollowUpNotesChange: (value: string) => void;
  onPrescriptionChange: (index: number, key: keyof PrescriptionRow, value: string) => void;
  onAddMedicine: () => void;
  onSaveDraft: () => void;
  onSendToPatient: () => void;
};

export default function NotesPanel({
  open,
  chiefComplaint,
  clinicalNotes,
  followUpDate,
  followUpNotes,
  prescriptionRows,
  onClose,
  onChiefComplaintChange,
  onClinicalNotesChange,
  onFollowUpDateChange,
  onFollowUpNotesChange,
  onPrescriptionChange,
  onAddMedicine,
  onSaveDraft,
  onSendToPatient,
}: NotesPanelProps) {
  return (
    <aside
      className={`fixed bottom-0 right-0 top-16 z-40 w-full border-l border-border bg-background transition-all duration-300 ease-in-out md:max-w-[40vw] ${
        open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full md:translate-y-0"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Consultation Notes</h2>
          <button
            type="button"
            title="Close notes"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <details open className="rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Chief Complaint</summary>
            <input
              value={chiefComplaint}
              onChange={(event) => onChiefComplaintChange(event.target.value)}
              placeholder="Enter chief complaint"
              className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </details>

          <details open className="rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Clinical Notes</summary>
            <textarea
              rows={6}
              value={clinicalNotes}
              onChange={(event) => onClinicalNotesChange(event.target.value)}
              placeholder="Document findings and recommendations"
              className="mt-3 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </details>

          <details open className="rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Prescription</summary>
            <div className="mt-3 space-y-2">
              {prescriptionRows.map((row, index) => (
                <div key={`row-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <input
                    value={row.medicine}
                    onChange={(event) => onPrescriptionChange(index, "medicine", event.target.value)}
                    placeholder="Medicine"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <input
                    value={row.dosage}
                    onChange={(event) => onPrescriptionChange(index, "dosage", event.target.value)}
                    placeholder="Dosage"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <input
                    value={row.duration}
                    onChange={(event) => onPrescriptionChange(index, "duration", event.target.value)}
                    placeholder="Duration"
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" className="mt-3 h-9" onClick={onAddMedicine}>
              <Plus className="mr-2 h-4 w-4" />
              Add Medicine
            </Button>
          </details>

          <details open className="rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Follow-up</summary>
            <div className="mt-3 space-y-2">
              <input
                type="date"
                value={followUpDate}
                onChange={(event) => onFollowUpDateChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              />
              <textarea
                rows={3}
                value={followUpNotes}
                onChange={(event) => onFollowUpNotesChange(event.target.value)}
                placeholder="Follow-up notes"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </details>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
          <Button type="button" variant="secondary" className="h-10" onClick={onSaveDraft}>
            Save Draft
          </Button>
          <Button type="button" className="h-10" onClick={onSendToPatient}>
            Send to Patient
          </Button>
        </div>
      </div>
    </aside>
  );
}
