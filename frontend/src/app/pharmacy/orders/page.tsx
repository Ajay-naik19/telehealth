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
  Package,
  Loader2,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { getUserProfile, getPharmacyOrders, type UserProfile, type PharmacyOrder } from "@/lib/api";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

export default function PharmacyOrdersPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, o] = await Promise.all([
          getUserProfile(),
          getPharmacyOrders(),
        ]);
        setProfile(p.profile);
        setOrders(o.orders || []);
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

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>;
  }

  return (
    <DashboardLayout navItems={patientNav} userName={userName} userInitial={userInitial} role="patient" footer={<Footer />}>
      <div className="space-y-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Track your pharmacy purchases.</p>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-500 dark:text-slate-300">No orders found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/pharmacy/orders/${order.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Order #{order.id}</p>
                <p className="text-sm text-slate-500 dark:text-slate-300">Placed: {new Date(order.created_at).toLocaleDateString()}</p>
                <p className="text-sm text-slate-500 dark:text-slate-300">Status: {order.status || "pending"}</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Total: Rs. {Number(order.total_amount || 0).toFixed(2)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
