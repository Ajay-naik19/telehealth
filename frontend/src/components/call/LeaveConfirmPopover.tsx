"use client";

import { Button } from "@/components/ui/button";

type LeaveConfirmPopoverProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function LeaveConfirmPopover({ open, onCancel, onConfirm }: LeaveConfirmPopoverProps) {
  if (!open) return null;

  return (
    <div className="absolute bottom-full right-0 mb-3 w-72 rounded-2xl border border-white/15 bg-black/75 p-4 text-white shadow-2xl backdrop-blur-xl">
      <p className="text-sm font-medium">Leave this call? The appointment will continue.</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="secondary" className="h-8 px-3" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" className="h-8 bg-red-600 px-3 text-white hover:bg-red-700" onClick={onConfirm}>
          Leave
        </Button>
      </div>
    </div>
  );
}
