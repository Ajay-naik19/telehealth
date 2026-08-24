"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  Video,
  Pill,
  FileText,
  Loader2,
  Upload,
  Search,
  FileUp,
  CalendarDays,
  Download,
  Trash2,
  Eye,
  FolderOpen,
  AlertTriangle,
  Tag,
  X,
  FileBadge,
  FlaskConical,
  Scan,
  FileHeart,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getUserProfile, type UserProfile } from "@/lib/api";
import { extractContractData, extractContractMessage, isContractFailure } from "@/lib/contract";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

const sectionAnim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

type RecordType =
  | "general"
  | "prescription"
  | "lab_report"
  | "imaging"
  | "discharge_summary";

interface VaultRecord {
  id: number;
  file_name: string;
  record_type: RecordType;
  uploaded_at?: string;
}

const RECORD_TYPES: { value: RecordType; label: string }[] = [
  { value: "general", label: "General Document" },
  { value: "prescription", label: "Prescription" },
  { value: "lab_report", label: "Lab Results" },
  { value: "imaging", label: "Imaging (X-Ray, MRI, etc.)" },
  { value: "discharge_summary", label: "Discharge Summary" },
];

function formatDate(dateInput?: string) {
  const date = dateInput ? new Date(dateInput) : new Date();
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getRecordTypeLabel(type: RecordType) {
  return RECORD_TYPES.find((t) => t.value === type)?.label || "General Document";
}

function RecordTypeIcon({ type }: { type: RecordType }) {
  if (type === "prescription") return <FileBadge className="h-5 w-5" />;
  if (type === "lab_report") return <FlaskConical className="h-5 w-5" />;
  if (type === "imaging") return <Scan className="h-5 w-5" />;
  if (type === "discharge_summary") return <FileHeart className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

export default function RecordsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState<RecordType>("general");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [previewRecord, setPreviewRecord] = useState<VaultRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<VaultRecord | null>(null);
  const [filterType, setFilterType] = useState<RecordType | "all">("all");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const initialTheme: "light" | "dark" =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : "light";

    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    localStorage.setItem("theme", initialTheme);
    setTheme(initialTheme);
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await fetch(`${API_BASE}/api/vault/user`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const raw = await res.json().catch(() => null);
      const data = extractContractData<VaultRecord[] | null>(raw);

      if (!res.ok || isContractFailure(raw)) {
        throw new Error(extractContractMessage(raw, `Server returned ${res.status}`));
      }

      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setRecords([]);
      setRecordsError("Unable to Load Records");
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getUserProfile()
      .then((res) => {
        if (!cancelled) setProfile(res.profile);
      })
      .catch(() => {
        if (!cancelled) router.replace("/auth/patient");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) loadRecords();
  }, [profile, loadRecords]);

  const userName = profile?.full_name?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase();

  const selectedFileMeta = useMemo(() => {
    if (!selectedFile) return { name: "No file selected", size: "0 KB", type: "No file type" };

    const sizeInKb = Math.round(selectedFile.size / 1024);
    const sizeInMb = (selectedFile.size / (1024 * 1024)).toFixed(2);
    const fileExt = (selectedFile.name.split(".").pop() || "unknown").toUpperCase();

    return {
      name: selectedFile.name,
      size: Number(sizeInMb) >= 1 ? `${sizeInMb} MB` : `${sizeInKb} KB`,
      type: `${fileExt} File`,
    };
  }, [selectedFile]);

  const filteredRecords = useMemo(
    () => (filterType === "all" ? records : records.filter((r) => r.record_type === filterType)),
    [records, filterType]
  );

  const typeConfig: Record<RecordType, { light: string; border: string; text: string; badge: string }> = {
    prescription: {
      light: "bg-sky-100 dark:bg-sky-900/40",
      border: "border-l-sky-500",
      text: "text-sky-700 dark:text-sky-300",
      badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
    },
    lab_report: {
      light: "bg-cyan-100 dark:bg-cyan-900/40",
      border: "border-l-cyan-500",
      text: "text-cyan-700 dark:text-cyan-300",
      badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200",
    },
    imaging: {
      light: "bg-blue-100 dark:bg-blue-900/40",
      border: "border-l-blue-500",
      text: "text-blue-700 dark:text-blue-300",
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
    },
    discharge_summary: {
      light: "bg-teal-100 dark:bg-teal-900/40",
      border: "border-l-teal-500",
      text: "text-teal-700 dark:text-teal-300",
      badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200",
    },
    general: {
      light: "bg-slate-100 dark:bg-slate-800",
      border: "border-l-slate-400",
      text: "text-slate-600 dark:text-slate-300",
      badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
  };

  const onDropFile = (file?: File) => {
    if (!file) return;
    setSelectedFile(file);
  };

  const openPreview = (record: VaultRecord) => {
    setPreviewRecord(record);
    setPreviewOpen(true);
  };

  const openDelete = (record: VaultRecord) => {
    setDeleteRecord(record);
    setDeleteOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("recordType", recordType);

      const res = await fetch(`${API_BASE}/vault/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const raw = await res.json().catch(() => null);
      if (!res.ok || isContractFailure(raw)) {
        throw new Error(extractContractMessage(raw, "Upload failed"));
      }

      toast.success("Record uploaded successfully.");
      setUploadOpen(false);
      setSelectedFile(null);
      setRecordType("general");
      loadRecords();
    } catch {
      toast.error("Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (record: VaultRecord) => {
    setDownloadingId(record.id);
    try {
      const res = await fetch(`${API_BASE}/api/vault/download/${record.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Unable to download file. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteRecord) return;

    setDeletingId(deleteRecord.id);
    try {
      const res = await fetch(`${API_BASE}/api/vault/${deleteRecord.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const raw = await res.json().catch(() => null);
      if (!res.ok || isContractFailure(raw)) {
        throw new Error(extractContractMessage(raw, "Failed to delete record"));
      }

      toast.success(`"${deleteRecord.file_name}" has been deleted.`);
      setDeleteOpen(false);
      setDeleteRecord(null);
      loadRecords();
    } catch {
      toast.error("Unable to delete record. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading your records...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      navItems={patientNav}
      userName={userName}
      userInitial={userInitial}
      role="patient"
      theme={theme}
      onToggleTheme={handleThemeToggle}
      footer={<Footer />}
    >
      <motion.section {...sectionAnim}>
        <div className="relative overflow-hidden rounded-3xl border border-sky-200 bg-sky-700 p-7 text-white shadow-sm dark:border-sky-800 dark:bg-sky-950">
          <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-white/15" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative">
            <h1 className="max-w-xl text-2xl font-black leading-tight text-white sm:text-3xl">
              Records Center
            </h1>
            <p className="mt-2 max-w-xl text-sm text-sky-100 sm:text-base">
              Keep all your medical files in one secure place and access them any time.
            </p>
            <button
              onClick={() => setUploadOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-sky-800 transition hover:bg-sky-50 dark:text-white"
            >
              <Upload className="h-4 w-4" />
              Upload Record
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section
        {...sectionAnim}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Document Library</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filterType === "all"
                  ? `Showing all ${records.length} records`
                  : `Showing ${filteredRecords.length} records in ${getRecordTypeLabel(filterType as RecordType)}`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as RecordType | "all")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-sky-500/20 sm:w-56"
              >
                <option value="all">All Record Types</option>
                {RECORD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-600"
              >
                <Upload className="h-4 w-4" />
                Add Record
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {recordsLoading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading your records...</p>
            </div>
          ) : recordsError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/40">
                <AlertTriangle className="h-8 w-8 text-sky-600 dark:text-sky-300" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Unable to Load Records</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Something went wrong while loading your vault.</p>
              </div>
              <button
                onClick={loadRecords}
                className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
              >
                Try Again
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-5 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800">
                <FolderOpen className="h-10 w-10 text-slate-400 dark:text-slate-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Records Yet</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Your medical vault is empty. Start by uploading your first document.
                </p>
              </div>
              <button
                onClick={() => setUploadOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-600"
              >
                <Upload className="h-4 w-4" />
                Upload First Record
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
              <Search className="h-9 w-9 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No records found for this filter.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredRecords.map((record) => {
                const cfg = typeConfig[record.record_type];
                return (
                  <article
                    key={record.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${cfg.light} ${cfg.text}`}>
                        <RecordTypeIcon type={record.record_type} />
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.badge}`}>
                        {getRecordTypeLabel(record.record_type)}
                      </span>
                    </div>

                    <h3 className="line-clamp-2 min-h-11 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {record.file_name}
                    </h3>

                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(record.uploaded_at)}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        onClick={() => openPreview(record)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button
                        onClick={() => handleDownload(record)}
                        disabled={downloadingId === record.id}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-sky-500 px-2 py-2 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-60"
                      >
                        {downloadingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
                      </button>
                      <button
                        onClick={() => openDelete(record)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </motion.section>

      {/* ── Upload Modal ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="overflow-hidden bg-white p-0 dark:bg-slate-900 sm:max-w-2xl">
          <div className="bg-sky-800 px-8 py-6 dark:bg-sky-950">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-lg text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                Upload Medical Record
              </DialogTitle>
              <DialogDescription className="mt-1 text-sky-100">
                Securely upload documents to your personal health vault.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 p-8">
            {/* Unified drag-drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onDropFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all duration-200 ${
                isDragOver
                  ? "border-sky-400 bg-sky-50 dark:bg-sky-500/10"
                  : selectedFile
                  ? "border-sky-400 bg-sky-50 dark:bg-sky-500/10"
                  : "border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
              }`}
            >
              {selectedFile ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedFileMeta.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {selectedFileMeta.size} &middot; {selectedFileMeta.type}
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
                    File selected — click to change
                  </span>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-500 dark:bg-sky-500/20 dark:text-sky-300">
                    <FileUp className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Drop your file here</p>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      or{" "}
                      <span className="text-sky-500 underline underline-offset-2">browse from your device</span>
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">PDF, JPG, PNG, DOCX supported &middot; Max 10 MB</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => onDropFile(e.target.files?.[0])}
            />

            {/* Record type selector */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Tag className="h-4 w-4 text-sky-500" /> Record Type
              </label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as RecordType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-sky-500/20"
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button
                variant="outline"
                className="rounded-xl px-5"
                onClick={() => { setUploadOpen(false); setSelectedFile(null); }}
              >
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="flex items-center gap-2 rounded-xl bg-sky-500 px-7 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-sky-600 hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Upload File"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Modal ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="overflow-hidden bg-white p-0 dark:bg-slate-900 sm:max-w-md">
          <div className="bg-slate-800 px-8 py-6 dark:bg-slate-950">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-lg text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                Document Preview
              </DialogTitle>
              <DialogDescription className="mt-1 text-slate-300">
                Details of your stored medical document.
              </DialogDescription>
            </DialogHeader>
          </div>

          {previewRecord && (
            <div className="p-6">
              {/* Icon */}
              <div className="mb-5 flex justify-center">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-3xl ${typeConfig[previewRecord.record_type].light}`}
                >
                  <span className={`scale-[1.8] ${typeConfig[previewRecord.record_type].text}`}>
                    <RecordTypeIcon type={previewRecord.record_type} />
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { label: "File Name", value: previewRecord.file_name },
                  { label: "Record Type", value: getRecordTypeLabel(previewRecord.record_type) },
                  { label: "Uploaded On", value: formatDate(previewRecord.uploaded_at) },
                  { label: "Record ID", value: `#${previewRecord.id}` },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700"
                  >
                    <span className="text-sm text-slate-500 dark:text-slate-400">{row.label}</span>
                    <span className="max-w-[58%] truncate text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Button variant="outline" className="rounded-xl" onClick={() => setPreviewOpen(false)}>
                  Close
                </Button>
                <button
                  onClick={() => handleDownload(previewRecord)}
                  disabled={downloadingId === previewRecord.id}
                  className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-sky-600 disabled:opacity-60"
                >
                  {downloadingId === previewRecord.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Modal ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="overflow-hidden bg-white p-0 dark:bg-slate-900 sm:max-w-sm">
          <div className="bg-slate-800 px-8 py-6 dark:bg-slate-950">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-lg text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <Trash2 className="h-5 w-5 text-white" />
                </div>
                Delete Record
              </DialogTitle>
              <DialogDescription className="mt-1 text-slate-300">
                This action is permanent and cannot be undone.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 p-6">
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-bold text-red-600 dark:text-red-400">
                  {deleteRecord ? `"${deleteRecord.file_name}"` : "this record"}
                </span>
                ?
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <button
                onClick={handleDelete}
                disabled={deletingId === deleteRecord?.id}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-red-600 active:scale-[0.97] disabled:opacity-60"
              >
                {deletingId === deleteRecord?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
