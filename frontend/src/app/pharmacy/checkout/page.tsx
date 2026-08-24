"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Calendar,
  FileText,
  Pill,
  Video,
  CreditCard,
  Loader2,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { getUserProfile, getCart, type UserProfile } from "@/lib/api";
import { placePharmacyOrder } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

export default function PharmacyCheckoutPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    notes: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [p, c] = await Promise.all([getUserProfile(), getCart()]);
        setProfile(p.profile);
        setSubtotal(c.subtotal || 0);
        setForm((prev) => ({
          ...prev,
          name: p.profile?.full_name || "",
        }));
      } catch {
        router.replace("/auth/patient");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const userName = profile?.full_name?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase();
  const shippingFee = subtotal >= 500 ? 0 : 49;
  const total = subtotal + shippingFee;

  const handlePlaceOrder = async () => {
    if (!form.name || !form.phone || !form.address || !form.city || !form.state || !form.pincode) {
      toast.error("Please fill all required shipping fields");
      return;
    }
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ""))) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }

    setPlacing(true);
    try {
      const orderRes = await placePharmacyOrder({
        ...form,
        phone: `+91${form.phone.replace(/\D/g, "")}`,
      });
      toast.success(orderRes.message || "Order confirmed successfully.");
      setTimeout(() => {
        router.push(`/pharmacy/orders/${orderRes.order.id}`);
      }, 700);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>;
  }

  return (
    <DashboardLayout navItems={patientNav} userName={userName} userInitial={userInitial} role="patient" footer={<Footer />}>
      <div className="space-y-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Checkout</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Enter shipping details and place your order.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Shipping Details</h2>
            <div className="space-y-3">
              <Input placeholder="Full name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Phone (10 digits)" value={form.phone} maxLength={10} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} />
              <Input placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              <Input placeholder="City" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
              <Input placeholder="State" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
              <Input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value }))} />
              <Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 dark:border-sky-500/30 dark:bg-sky-500/10">
            <p className="text-sm text-slate-600 dark:text-slate-300">Subtotal: Rs. {subtotal.toFixed(2)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Shipping: Rs. {shippingFee.toFixed(2)}</p>
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">Order Total: Rs. {total.toFixed(2)}</p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={handlePlaceOrder} disabled={placing} className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60">
                <CreditCard className="mr-2 inline h-4 w-4" /> {placing ? "Placing..." : "Place Order"}
              </button>
              <Link href="/pharmacy/cart" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Back to Cart</Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
