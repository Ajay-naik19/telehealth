"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Calendar,
  FileText,
  Pill,
  Video,
  Loader2,
  ShoppingCart,
  Heart,
  Star,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { getUserProfile, addToCart, toggleWishlist, getPharmacyProductBySlug, type UserProfile, type PharmacyProduct } from "@/lib/api";
import { toast } from "sonner";

const patientNav: NavItem[] = [
  { href: "/patient/home", label: "Home", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/video/dashboard", label: "Video Consult", icon: Video },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/records", label: "My Records", icon: FileText },
];

const PHARMACY_FALLBACK_IMAGE = "/images/medical-pattern.png";

export default function PharmacyProductPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [product, setProduct] = useState<PharmacyProduct | null>(null);
  const [reviews, setReviews] = useState<Array<{ id: number; rating: number; title?: string | null; comment?: string | null; reviewer_name?: string }>>([]);
  const [inWishlist, setInWishlist] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [updatingWishlist, setUpdatingWishlist] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, pr] = await Promise.all([
          getUserProfile(),
          getPharmacyProductBySlug(params.slug),
        ]);
        setProfile(p.profile);
        setProduct(pr.product || null);
        setReviews(pr.reviews || []);
        setInWishlist(Boolean(pr.inWishlist));
      } catch {
        router.replace("/auth/patient");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.slug, router]);

  const userName = profile?.full_name?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase();

  const onCart = async () => {
    if (!product || addingToCart) return;
    setAddingToCart(true);
    try {
      await addToCart(product.id, 1);
      toast.success("Added to cart successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const onWishlist = async () => {
    if (!product || updatingWishlist) return;
    setUpdatingWishlist(true);
    try {
      const result = await toggleWishlist(product.id);
      setInWishlist(Boolean(result.added));
      toast.success(result.added ? "Added to wishlist successfully." : "Removed from wishlist successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update wishlist");
    } finally {
      setUpdatingWishlist(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>;
  }

  return (
    <DashboardLayout navItems={patientNav} userName={userName} userInitial={userInitial} role="patient" footer={<Footer />}>
      <div className="space-y-6 pb-12">
        {!product ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-slate-500 dark:text-slate-300">Product not found.</p>
            <Link href="/pharmacy" className="mt-4 inline-block rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">Back to Pharmacy</Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <img
                  src={product.image_url || PHARMACY_FALLBACK_IMAGE}
                  alt={product.name}
                  className="h-72 w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PHARMACY_FALLBACK_IMAGE;
                  }}
                />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{product.name}</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Category: {product.category_name}</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">Rs. {product.price}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Stock: {product.stock_quantity}</p>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{product.description || "No description available"}</p>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={onCart}
                    disabled={addingToCart}
                    className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addingToCart ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 inline h-4 w-4" />} {addingToCart ? "Adding..." : "Add to Cart"}
                  </button>
                  <button
                    type="button"
                    onClick={onWishlist}
                    disabled={updatingWishlist}
                    className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {updatingWishlist ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Heart className={`mr-2 inline h-4 w-4 ${inWishlist ? "fill-current text-sky-600" : ""}`} />} {inWishlist ? "Wishlisted" : "Wishlist"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Recent Reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">No reviews yet.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{review.reviewer_name || "Anonymous"}</p>
                      <p className="my-1 flex items-center gap-1 text-sm text-amber-500">{Array.from({ length: review.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{review.comment || review.title || "-"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
