"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  Calendar,
  FileText,
  Pill,
  Video,
  Package,
  Loader2,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { getUserProfile, getPharmacyOrderDetail, type UserProfile, type PharmacyOrder, type PharmacyOrderItem } from "@/lib/api";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

export default function PharmacyOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [order, setOrder] = useState<(PharmacyOrder & { items: PharmacyOrderItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, o] = await Promise.all([
          getUserProfile(),
          getPharmacyOrderDetail(Number(params.id)),
        ]);
        setProfile(p.profile);
        setOrder(o.order || null);
      } catch {
        router.replace("/auth/patient");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, router]);

  const userName = profile?.full_name?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>;
  }

  return (
    <DashboardLayout navItems={patientNav} userName={userName} userInitial={userInitial} role="patient" footer={<Footer />}>
      <div className="space-y-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Order Detail</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Order #{params.id}</p>
        </div>

        {!order ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-500 dark:text-slate-300">Order not found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Status: {order.status || "pending"}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Placed: {new Date(order.created_at).toLocaleString()}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Total: Rs. {Number(order.total_amount ?? 0).toFixed(2)}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Shipping: {order.shipping_address}, {order.shipping_city}, {order.shipping_state} - {order.shipping_pincode}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Items</h2>
              <div className="space-y-3">
                {order.items?.map((item) => (
                  <div key={`${item.order_id}-${item.product_id}`} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{item.product_name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-300">Qty: {item.quantity} · Unit: Rs. {item.unit_price}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rs. {item.total_price}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
