"use client";

import { Button } from "@/components/ui/button";

type EndCallModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function EndCallModal({ open, onCancel, onConfirm }: EndCallModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground">End Appointment?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This will end the call for both you and the patient.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirm}>
            End Appointment
          </Button>
        </div>
      </div>
    </div>
  );
}
