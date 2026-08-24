"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Phone,
  Mail,
  User,
  MessageSquare,
  Send,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const contactInfo = [
  {
    icon: MapPin,
    label: "Visit Us",
    value: "123 Healthcare Blvd, New York, NY 10001",
  },
  {
    icon: Phone,
    label: "Call Us",
    value: "+1 (555) 123-4567",
  },
  {
    icon: Mail,
    label: "Email Us",
    value: "support@telehealthx.com",
  },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const handlePhoneInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    let val = input.value;
    const hasPlus = val.startsWith("+");
    val = val.replace(/[^0-9]/g, "");
    if (val.length > 10) val = val.slice(0, 10);
    input.value = hasPlus ? "+" + val : val;
  };

  const inputClasses =
    "h-12 rounded-xl border border-slate-200 bg-slate-50/60 pl-10 text-[15px] text-slate-900 shadow-sm transition-all duration-250 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:focus:ring-sky-500/20";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />

      {/* Header */}
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="content-overlay pb-4 pt-20 text-center"
      >
        <div className="mx-auto max-w-3xl px-6">
          <span className="mb-3 inline-block text-[13px] font-bold uppercase tracking-wider text-sky-600">
            Contact Us
          </span>
          <h1 className="font-heading text-[36px] font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-[42px]">
            Get in Touch
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed text-slate-500 dark:text-slate-300">
            Have a question or need assistance? We&apos;re here to help. Reach
            out to our team and we&apos;ll get back to you promptly.
          </p>
        </div>
      </motion.section>

      {/* Cards */}
      <motion.section
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="content-overlay py-16"
      >
        <div className="mx-auto grid max-w-5xl gap-8 px-6 md:grid-cols-2">
          {/* Contact Info Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-heading mb-6 text-[22px] font-bold text-slate-900 dark:text-slate-100">
              Contact Information
            </h2>
            <div className="space-y-6">
              {contactInfo.map((item) => (
                <div key={item.label} className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-700">
                    <item.icon className="h-5 w-5 text-sky-600 dark:text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold uppercase tracking-wider text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-1 text-[15px] text-slate-700 dark:text-slate-200">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-xl bg-linear-to-br from-sky-50 to-blue-50 p-5 dark:from-slate-800 dark:to-slate-800">
              <p className="text-[14px] font-semibold text-sky-700">
                Business Hours
              </p>
              <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">
                Mon–Fri: 8:00 AM – 8:00 PM EST
              </p>
              <p className="text-[13px] text-slate-600 dark:text-slate-300">
                Sat–Sun: 9:00 AM – 5:00 PM EST
              </p>
            </div>
          </div>

          {/* Contact Form Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-heading mb-6 text-[22px] font-bold text-slate-900 dark:text-slate-100">
              Send a Message
            </h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="name" className="text-[12px] font-bold text-slate-500 dark:text-slate-300">
                  Your Name
                </Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="Enter your name"
                    className={inputClasses}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email" className="text-[12px] font-bold text-slate-500 dark:text-slate-300">
                  Email
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="Enter your email"
                    className={inputClasses}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="text-[12px] font-bold text-slate-500 dark:text-slate-300">
                  Phone
                </Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="Enter phone number"
                    maxLength={11}
                    onInput={handlePhoneInput}
                    className={inputClasses}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="message" className="text-[12px] font-bold text-slate-500 dark:text-slate-300">
                  Message
                </Label>
                <div className="relative mt-1">
                  <MessageSquare className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    placeholder="Tell us how we can help..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 pt-3 text-[15px] text-slate-900 shadow-sm transition-all duration-250 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {submitted ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-[14px] font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Message sent successfully!
                </div>
              ) : (
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-sky-500 text-[16px] font-bold text-white shadow-lg shadow-sky-500/20 transition-all duration-250 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-sky-600 hover:shadow-xl hover:shadow-sky-500/25 active:translate-y-0 active:scale-100"
                >
                  Send Message
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              )}
            </form>
          </div>
        </div>
      </motion.section>

      {/* Google Map */}
      <section className="content-overlay px-6 pb-16">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm dark:border-slate-700">
          <iframe
            title="TeleHealthx Location"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.9663095343037!2d-73.99026868459423!3d40.74076797932784!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1680000000000!5m2!1sen!2sus"
            width="100%"
            height="400"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full"
          />
        </div>
      </section>

      <Footer />
    </div>
  );
}
