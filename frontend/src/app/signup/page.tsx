"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserPlus, FileText } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Suspense } from 'react';
import Logo from "@/components/Logo";
import { signup } from "@/services/auth.client";
import { getPostAuthRoute, type AppRole } from "@/config/routes";
import { ApiError } from "@/lib/api";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("type") === "doctor" ? "doctor" : "patient";
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handlePhoneInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    let val = input.value.replace(/\D/g, "");
    if (val.length > 10) val = val.slice(0, 10);
    input.value = val;
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((v, k) => { data[k] = v as string; });

    // Validate passwords match client-side
    if (data.password !== data.confirmpassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    // Ensure phone has country code prefix for backend validation
    const digitsOnly = (data.phone || "").replace(/\D/g, "");
    if (digitsOnly.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      setLoading(false);
      return;
    }
    data.phone = `+91${digitsOnly}`;

    const role = (activeTab === "doctor" ? "doctor" : "patient") as AppRole;

    try {
      const user = await signup(role, data.phone, data.password, data.confirmpassword);
      const redirect = getPostAuthRoute(user.role, Boolean(user.profileComplete));
      router.replace(redirect);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || "Registration failed. Please check your details.");
      } else {
        setError("Registration failed.");
      }
      setLoading(false);
    }
  };

  return (
    <motion.div 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
    >
      <div className="bg-white py-10 px-6 shadow-2xl sm:rounded-3xl sm:px-12 border border-slate-100">
        
        <Tabs defaultValue={defaultTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100 h-14 rounded-2xl p-1">
            <TabsTrigger value="patient" className="rounded-xl text-base font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Patient</TabsTrigger>
            <TabsTrigger value="doctor" className="rounded-xl text-base font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Doctor</TabsTrigger>
          </TabsList>

          <form className="space-y-6" onSubmit={handleSignup}>
            <div>
              <Label htmlFor="name" className="text-slate-700 font-bold">Full Name</Label>
              <div className="mt-2 relative">
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="pl-4 h-14 bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-sky-500 shadow-sm rounded-xl text-lg transition-all"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            {/* In the older version it was email, but backend requires phone + password schema */}
            {activeTab === "doctor" && (
              <div>
                <Label htmlFor="email" className="text-slate-700 font-bold">Work Email (Doctors Only)</Label>
                <div className="mt-2 relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="pl-4 h-14 bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-sky-500 shadow-sm rounded-xl text-lg transition-all"
                    placeholder="Enter your email"
                  />
                </div>
              </div>
            )}
            
            {(activeTab === "patient" || activeTab === "doctor") && (
              <div>
                <Label htmlFor="phone" className="text-slate-700 font-bold">Phone Number</Label>
                <div className="mt-2 relative">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    className="pl-4 h-14 bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-sky-500 shadow-sm rounded-xl text-lg transition-all"
                    placeholder="e.g. 9876543210"
                    maxLength={10}
                    onInput={handlePhoneInput}
                  />
                </div>
              </div>
            )}

            {activeTab === "doctor" && (
               <div>
                  <Label htmlFor="registration_number" className="text-slate-700 font-bold">Medical Registration ID</Label>
                  <div className="mt-2 relative">
                    <Input
                      id="registration_number"
                      name="registration_number"
                      type="text"
                      className="pl-4 h-14 bg-slate-50 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 shadow-sm rounded-xl text-lg transition-all"
                      placeholder="Enter registration ID"
                    />
                  </div>
               </div>
            )}

            <div>
              <Label htmlFor="password" className="text-slate-700 font-bold">Password</Label>
              <div className="mt-2 relative">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="pl-4 h-14 bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-sky-500 shadow-sm rounded-xl text-lg transition-all"
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmpassword" className="text-slate-700 font-bold">Confirm Password</Label>
              <div className="mt-2 relative">
                <Input
                  id="confirmpassword"
                  name="confirmpassword"
                  type="password"
                  required
                  className="pl-4 h-14 bg-slate-50 border-slate-200 focus:border-sky-500 focus:ring-sky-500 shadow-sm rounded-xl text-lg transition-all"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm font-semibold bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-2">
                <FileText className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <div className="pt-4">
              <Button 
                type="submit" 
                disabled={loading}
                className={`w-full flex justify-center py-7 px-4 rounded-xl shadow-xl text-lg font-bold text-white transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 ${
                  activeTab === "doctor" 
                    ? "bg-sky-500 hover:bg-sky-600 shadow-sky-500/30" 
                    : "bg-sky-500 hover:bg-sky-600 shadow-sky-500/30"
                }`}
              >
                {loading ? (
                  <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Create {activeTab === "doctor" ? "Doctor" : "Patient"} Account <UserPlus className="ml-3 w-6 h-6" />
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-sm text-center text-slate-500 mt-6 font-medium">
              By registering, you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </Tabs>
      </div>
    </motion.div>
  );
}

export default function SignupPage() {
  return (
    <div className="auth-hero-bg min-h-screen flex flex-col justify-center py-12 selection:bg-sky-200 sm:px-6 lg:px-8">

      <motion.div 
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <Link href="/" className="mb-6 flex cursor-pointer items-center justify-center gap-3 transition-opacity hover:opacity-80">
          <Logo size="lg" />
        </Link>
        <h2 className="mt-4 text-center text-4xl font-extrabold text-white tracking-tight">
          Join us today
        </h2>
        <p className="mt-3 text-center text-base text-sky-100 font-medium">
          Already have an account?{" "}
          <Link href="/auth" className="text-sky-200 hover:text-white transition-colors font-bold hover:underline">
            Log in here
          </Link>
        </p>
      </motion.div>

      <Suspense fallback={<div className="text-center mt-10 font-bold text-slate-500 animate-pulse">Loading secure form...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
