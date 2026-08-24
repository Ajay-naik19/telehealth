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
  Heart,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { getUserProfile, getWishlist, addToCart, toggleWishlist, type UserProfile, type PharmacyProduct } from "@/lib/api";
import { toast } from "sonner";

type WishlistProduct = PharmacyProduct & { product_id: number };

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

const PHARMACY_FALLBACK_IMAGE = "/images/medical-pattern.png";

export default function PharmacyWishlistPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProductId, setBusyProductId] = useState<number | null>(null);

  const load = async () => {
    const [p, w] = await Promise.all([getUserProfile(), getWishlist()]);
    setProfile(p.profile);
    setItems((w.wishlist || []) as WishlistProduct[]);
  };

  useEffect(() => {
    load().catch(() => { router.replace("/auth/patient"); }).finally(() => setLoading(false));
  }, [router]);

  const userName = profile?.full_name?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase();

  const removeWish = async (productId: number) => {
    setBusyProductId(productId);
    try {
      await toggleWishlist(productId);
      await load();
      toast.success("Removed from wishlist successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update wishlist");
    } finally {
      setBusyProductId(null);
    }
  };

  const moveToCart = async (productId: number) => {
    setBusyProductId(productId);
    try {
      await addToCart(productId, 1);
      toast.success("Added to cart successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setBusyProductId(null);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>;
  }

  return (
    <DashboardLayout navItems={patientNav} userName={userName} userInitial={userInitial} role="patient" footer={<Footer />}>
      <div className="space-y-6 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Wishlist</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Your saved medicines.</p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <Heart className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-slate-500 dark:text-slate-300">Wishlist is empty.</p>
            <Link href="/pharmacy" className="mt-4 inline-block rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">Browse Pharmacy</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.product_id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/pharmacy/product/${item.slug}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <img
                      src={item.image_url || PHARMACY_FALLBACK_IMAGE}
                      alt={item.name}
                      className="h-14 w-14 rounded-lg object-cover"
                      onError={(event) => {
                        event.currentTarget.src = PHARMACY_FALLBACK_IMAGE;
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 group-hover:text-sky-600 dark:text-slate-100 dark:group-hover:text-sky-300">{item.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-300">Rs. {item.price}</p>
                    </div>
                  </Link>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={busyProductId === item.product_id}
                      onClick={() => removeWish(item.product_id)}
                    >
                      {busyProductId === item.product_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Heart className="mr-2 h-4 w-4" />} Remove
                    </Button>
                    <Button
                      disabled={busyProductId === item.product_id}
                      onClick={() => moveToCart(item.product_id)}
                      className="bg-sky-500 hover:bg-sky-600"
                    >
                      {busyProductId === item.product_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />} Add to Cart
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
