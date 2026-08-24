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
  ShoppingCart,
  Trash2,
  Loader2,
  Plus,
  Minus,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { getUserProfile, getCart, removeFromCart, updateCartItem, type UserProfile, type CartItem } from "@/lib/api";
import { toast } from "sonner";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

export default function PharmacyCartPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshCart = async () => {
    const c = await getCart();
    setItems(c.items || []);
    setSubtotal(c.subtotal || 0);
  };

  useEffect(() => {
    async function load() {
      try {
        const [p, c] = await Promise.all([getUserProfile(), getCart()]);
        setProfile(p.profile);
        setItems(c.items || []);
        setSubtotal(c.subtotal || 0);
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

  const handleRemove = async (productId: number) => {
    try {
      await removeFromCart(productId);
      await refreshCart();
      toast.success("Removed from cart");
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const handleQuantityChange = async (productId: number, quantity: number) => {
    if (quantity < 1 || quantity > 50) return;
    try {
      await updateCartItem(productId, quantity);
      await refreshCart();
      toast.success("Cart updated successfully.");
    } catch {
      toast.error("Failed to update quantity");
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>;
  }

  return (
    <DashboardLayout navItems={patientNav} userName={userName} userInitial={userInitial} role="patient" footer={<Footer />}>
      <div className="space-y-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cart</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Review medicines before checkout.</p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-500 dark:text-slate-300">Your cart is empty.</p>
            <Link href="/pharmacy" className="mt-4 inline-block rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">Browse Pharmacy</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.product_id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Rs. {item.price} each</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Line total: Rs. {(Number(item.price) * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">{item.quantity}</span>
                  <Button variant="outline" size="icon" onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => handleRemove(item.product_id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-500/30 dark:bg-sky-500/10">
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Subtotal: Rs. {subtotal}</p>
              <Link href="/pharmacy/checkout" className="mt-3 inline-block rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">Proceed to Checkout</Link>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
