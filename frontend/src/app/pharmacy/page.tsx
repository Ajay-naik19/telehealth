"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  FileText,
  Heart,
  Loader2,
  Pill,
  Search,
  ShoppingCart,
  Star,
  StarHalf,
  TriangleAlert,
  Video,
} from "lucide-react";
import DashboardLayout, { type NavItem } from "@/components/DashboardLayout";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { getUserProfile, type UserProfile } from "@/lib/api";
import { extractContractData, extractContractMessage, isContractFailure } from "@/lib/contract";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";
const PHARMACY_FALLBACK_IMAGE = "/images/medical-pattern.png";

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

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Product {
  id: number;
  slug: string;
  name: string;
  image_url?: string;
  category_name: string;
  price: string | number;
  compare_at_price?: string | number | null;
  avg_rating: string | number;
  review_count: number;
  stock_quantity: number;
  prescription_required?: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProductsResponse {
  success: boolean;
  products: Product[];
  pagination: Pagination;
  error?: string;
}

interface WishlistItem {
  product_id: number;
}

export default function PharmacyPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const [cartActionId, setCartActionId] = useState<number | null>(null);
  const [wishActionId, setWishActionId] = useState<number | null>(null);
  const [wishlistMap, setWishlistMap] = useState<Record<number, boolean>>({});

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
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pharmacy/categories`, { credentials: "include" });
        const raw = await res.json().catch(() => null);
        const data = extractContractData<{ categories?: Category[] } | Category[] | null>(raw);
        if (res.ok && !isContractFailure(raw)) {
          if (Array.isArray(data)) {
            setCategories(data);
          } else if (Array.isArray(data?.categories)) {
            setCategories(data.categories);
          }
        }
      } catch {
        // Non-blocking; products can still load.
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadWishlist = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pharmacy/wishlist`, { credentials: "include" });
        const raw = await res.json().catch(() => null);
        const data = extractContractData<{ wishlist?: WishlistItem[] } | WishlistItem[] | null>(raw);
        if (!res.ok || isContractFailure(raw)) return;

        const wishlist = Array.isArray(data) ? data : data?.wishlist;
        if (!Array.isArray(wishlist)) return;

        const map: Record<number, boolean> = {};
        wishlist.forEach((item) => {
          map[item.product_id] = true;
        });
        setWishlistMap(map);
      } catch {
        // Keep page usable even if wishlist endpoint is unavailable.
      }
    };

    loadWishlist();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError(null);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "12");
      if (categoryId) params.set("category_id", categoryId);
      if (search) params.set("search", search);
      if (sort !== "default") params.set("sort", sort);
      if (priceMin) params.set("price_min", priceMin);
      if (priceMax) params.set("price_max", priceMax);

      try {
        const res = await fetch(`${API_BASE}/api/pharmacy/products?${params.toString()}`, {
          credentials: "include",
        });
        const raw = await res.json().catch(() => null);
        const data = extractContractData<ProductsResponse | null>(raw);
        if (!res.ok || isContractFailure(raw) || !data) {
          throw new Error(extractContractMessage(raw, "Failed to load products"));
        }

        setProducts(Array.isArray(data.products) ? data.products : []);
        setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
      } catch (error) {
        setProducts([]);
        setPagination({ page: 1, limit: 12, total: 0, totalPages: 1 });
        setProductsError(error instanceof Error ? error.message : "Failed to load products");
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, [page, categoryId, search, sort, priceMin, priceMax]);

  const userName = profile?.full_name?.split(" ")[0] || "Patient";
  const userInitial = userName.charAt(0).toUpperCase();

  const visiblePages = useMemo(() => {
    const start = Math.max(1, pagination.page - 2);
    const end = Math.min(pagination.totalPages, pagination.page + 2);
    const pages: number[] = [];
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [pagination.page, pagination.totalPages]);

  const applyPriceFilter = () => {
    setPriceMin(priceMinInput.trim());
    setPriceMax(priceMaxInput.trim());
    setPage(1);
  };

  const clearPriceFilter = () => {
    setPriceMinInput("");
    setPriceMaxInput("");
    setPriceMin("");
    setPriceMax("");
    setPage(1);
  };

  const addToCart = async (productId: number) => {
    setCartActionId(productId);
    try {
      const res = await fetch(`${API_BASE}/api/pharmacy/cart/add`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok || isContractFailure(raw)) {
        throw new Error(extractContractMessage(raw, "Failed to add to cart"));
      }
      toast.success("Added to cart!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add to cart");
    } finally {
      setCartActionId(null);
    }
  };

  const toggleWishlist = async (productId: number) => {
    setWishActionId(productId);
    try {
      const res = await fetch(`${API_BASE}/api/pharmacy/wishlist/toggle`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok || isContractFailure(raw)) {
        throw new Error(extractContractMessage(raw, "Failed to update wishlist"));
      }

      const data = extractContractData<{ added?: boolean } | null>(raw);
      const added = !!data?.added;

      setWishlistMap((prev) => ({ ...prev, [productId]: added }));
      toast.success(added ? "Added to wishlist!" : "Removed from wishlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update wishlist");
    } finally {
      setWishActionId(null);
    }
  };

  const renderStars = (rawRating: number | string) => {
    const rating = Math.max(0, Math.min(5, Number(rawRating) || 0));
    const rounded = Math.round(rating * 2) / 2;

    return (
      <div className="flex items-center gap-0.5 text-amber-500">
        {[1, 2, 3, 4, 5].map((slot) => {
          if (slot <= Math.floor(rounded)) {
            return <Star key={slot} className="h-3.5 w-3.5 fill-current" />;
          }
          if (slot - 0.5 <= rounded) {
            return <StarHalf key={slot} className="h-3.5 w-3.5 fill-current" />;
          }
          return <Star key={slot} className="h-3.5 w-3.5" />;
        })}
      </div>
    );
  };

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
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
      <motion.section
        {...sectionAnim}
        className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h1 className="bg-linear-to-r from-sky-500 to-emerald-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          TeleHealthx Pharmacy
        </h1>
        <p className="mt-2 text-[15px] text-slate-500 dark:text-slate-300">
          Browse our wide range of medicines, health products, and medical devices.
        </p>
      </motion.section>

      <motion.section
        {...sectionAnim}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-55 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search medicines, health products..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-sky-500/20"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-sky-500/20"
          >
            <option value="default">Sort: Default</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest First</option>
          </select>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setCategoryId("");
              setPage(1);
            }}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              categoryId === ""
                ? "border-sky-500 bg-sky-500 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setCategoryId(String(category.id));
                setPage(1);
              }}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                categoryId === String(category.id)
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Price:</span>
          <input
            type="number"
            min={0}
            value={priceMinInput}
            onChange={(e) => setPriceMinInput(e.target.value)}
            placeholder="Min"
            className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <span className="text-xs text-slate-400">-</span>
          <input
            type="number"
            min={0}
            value={priceMaxInput}
            onChange={(e) => setPriceMaxInput(e.target.value)}
            placeholder="Max"
            className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <Button className="h-9 rounded-lg bg-sky-500 px-4 text-xs text-white hover:bg-sky-600" onClick={applyPriceFilter}>
            Apply
          </Button>
          <Button variant="outline" className="h-9 rounded-lg px-4 text-xs" onClick={clearPriceFilter}>
            Clear
          </Button>
        </div>

        {productsLoading ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <Loader2 className="mb-2 h-9 w-9 animate-spin text-sky-500" />
            <p className="text-sm text-slate-500 dark:text-slate-300">Loading products...</p>
          </div>
        ) : productsError ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <TriangleAlert className="mb-2 h-9 w-9 text-red-500" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Failed to load products</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{productsError}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <Search className="mb-2 h-9 w-9 text-slate-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No products found</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Try changing your filters or search term.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => {
                const price = Number(product.price || 0);
                const compare = product.compare_at_price ? Number(product.compare_at_price) : null;
                const inStock = Number(product.stock_quantity || 0) > 0;
                const isWished = !!wishlistMap[product.id];

                return (
                  <div
                    key={product.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/pharmacy/product/${product.slug}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/pharmacy/product/${product.slug}`);
                      }
                    }}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={product.image_url || PHARMACY_FALLBACK_IMAGE}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(event) => {
                          const target = event.currentTarget;
                          target.src = PHARMACY_FALLBACK_IMAGE;
                        }}
                      />
                      {product.prescription_required && (
                        <span className="absolute left-2 top-2 rounded-md bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white">
                          Rx
                        </span>
                      )}
                      {!inStock && (
                        <span className="absolute right-2 top-2 rounded-md bg-red-500 px-2 py-1 text-[10px] font-semibold text-white">
                          Out of Stock
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300">
                        {product.category_name}
                      </p>
                      <h3 className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-900 hover:text-sky-600 dark:text-slate-100 dark:hover:text-sky-300">
                        {product.name}
                      </h3>

                      <div className="mt-1 flex items-center gap-1.5">
                        {renderStars(product.avg_rating)}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">({product.review_count || 0})</span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Rs.{price.toFixed(0)}</span>
                        {compare ? (
                          <span className="text-xs text-slate-400 line-through dark:text-slate-500">Rs.{compare.toFixed(0)}</span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          className="h-9 flex-1 rounded-lg bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600"
                          disabled={!inStock || cartActionId === product.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            addToCart(product.id);
                          }}
                        >
                          {cartActionId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ShoppingCart className="mr-1 h-4 w-4" />
                              {inStock ? "Add to Cart" : "Out of Stock"}
                            </>
                          )}
                        </Button>

                        <button
                          type="button"
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                            isWished
                              ? "border-red-300 text-red-500 dark:border-red-500/40 dark:text-red-300"
                              : "border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-500 dark:border-slate-700 dark:text-slate-300"
                          }`}
                          disabled={wishActionId === product.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleWishlist(product.id);
                          }}
                          aria-label="Toggle wishlist"
                        >
                          {wishActionId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Heart className={`h-4 w-4 ${isWished ? "fill-current" : ""}`} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Prev
                </button>

                {visiblePages.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPage(p);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                      p === pagination.page
                        ? "border-sky-500 bg-sky-500 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </motion.section>
    </DashboardLayout>
  );
}
