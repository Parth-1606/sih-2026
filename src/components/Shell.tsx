"use client";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const NAV = [
  { id: "overview", label: "Overview", href: "/", icon: GridIcon },
  { id: "marine_map", label: "Marine Map", href: "/map", icon: MapIcon },
  { id: "assistant", label: "AI Assistant", href: "/assistant", icon: SparkleIcon },
  { id: "alerts", label: "Alerts", href: "/alerts", icon: BellIcon },
  { id: "routes", label: "Route Planner", href: "/routes", icon: RouteIcon },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: ChartIcon },
  { id: "sources", label: "Data Sources", href: "/sources", icon: GlobeIcon },
];
const BOTTOM = [
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "language", label: "Language", icon: GlobeIcon },
  { id: "profile", label: "Profile", icon: UserIcon },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [dataState, setDataState] = useState<"LIVE" | "SYNCING" | "OFFLINE">("LIVE");

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setShowSearch(v => !v); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);



  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar — shadcn Card styling via custom */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="hidden md:flex flex-col shrink-0 sticky top-0 h-screen border-r bg-sidebar text-sidebar-foreground z-30 transition-[width] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]"
        style={{ width: hovered ? 240 : 72 }}
      >
        <div className="h-[64px] flex items-center gap-3 px-4 border-b shrink-0">
          <div className="size-8 rounded-lg bg-[#0A2733] border flex items-center justify-center shrink-0">
            <div className="size-3 rounded-full bg-[#4BA3FF] shadow-[0_0_12px_rgba(75,163,255,0.6)]" />
          </div>
          <motion.div initial={false} animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : -6 }} className="overflow-hidden whitespace-nowrap">
            {hovered && <div className="text-[13px] font-semibold tracking-[-0.01em] leading-none">MARINE INTELLIGENCE</div>}
            {hovered && <div className="text-[10px] tracking-[0.12em] text-muted-foreground font-medium">MISSION CONTROL</div>}
          </motion.div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            const item = (
              <Button
                key={href}
                variant={active ? "default" : "ghost"}
                size="default"
                className={`w-full justify-start gap-3 px-3 py-[10px] h-auto rounded-xl text-[13.5px] ${active ? "" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => router.push(href)}
              >
                <Icon active={active} />
                <span className={`whitespace-nowrap transition-all duration-200 ${hovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"} `}>{label}</span>
              </Button>
            );
            if (!hovered) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger render={item} />
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }
            return item;
          })}
        </nav>

        <Separator />
        <div className="p-2 space-y-1">
          {BOTTOM.map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => alert(`${label} — coming soon`)}
            >
              <Icon /> <span className={`${hovered ? "opacity-100" : "opacity-0 pointer-events-none"} whitespace-nowrap transition-opacity`}>{label}</span>
            </Button>
          ))}
          <div className={`mx-2 mt-3 rounded-xl bg-card border p-3 transition-opacity ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <div className="flex items-center gap-2.5">
              <Avatar className="size-7">
                <AvatarImage src="https://i.pravatar.cc/100?img=12" alt="Arjun Mehra" />
                <AvatarFallback>AM</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-xs font-medium leading-none">Arjun Mehra</div>
                <div className="text-[11px] text-muted-foreground">Research Officer</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar — shadcn Button + Badge + Avatar */}
        <header className="h-[64px] sticky top-0 z-20 flex items-center gap-3 px-4 md:px-6 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 glass">
          <Dialog open={showLocation} onOpenChange={setShowLocation}>
            <Button variant="default" size="sm" className="hidden sm:flex rounded-full gap-2" onClick={() => setShowLocation(true)}>
              <span className="size-2 rounded-full bg-[#35C98A] shadow-[0_0_8px_rgba(53,201,138,0.6)] inline-block" /> My Location <ChevronDown />
            </Button>
          </Dialog>

          <div className="flex-1 max-w-[640px] relative">
            <Button variant="secondary" className="w-full justify-start gap-3 px-4 py-2.5 rounded-full bg-card border text-muted-foreground hover:bg-card h-10 font-normal" onClick={() => setShowSearch(true)}>
              <SearchIcon /> <span className="hidden sm:inline text-[13.5px]">Ask about the ocean, weather, PFZs or safety…</span><span className="sm:hidden">Ask about ocean…</span>
              <Badge variant="default" className="ml-auto hidden sm:flex text-[11px] px-1.5 py-0.5">⌘K</Badge>
            </Button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={dataState === "LIVE" ? "default" : dataState === "SYNCING" ? "secondary" : "outline"}
              className={`hidden sm:flex gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.08em] cursor-pointer ${dataState === "LIVE" ? "bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/20 hover:bg-[#35C98A]/20" : dataState === "SYNCING" ? "bg-[#F4B942]/15 text-[#F4B942] border-[#F4B942]/20" : "bg-muted text-muted-foreground"}`}
              onClick={() => setDataState(s => s === "LIVE" ? "SYNCING" : s === "SYNCING" ? "OFFLINE" : "LIVE")}
            >
              <span className={`size-1.5 rounded-full ${dataState === "LIVE" ? "bg-[#35C98A] animate-pulse" : dataState === "SYNCING" ? "bg-[#F4B942] animate-pulse" : "bg-white/40"}`} /> {dataState}
            </Badge>
            <Button variant="secondary" size="icon" className="relative size-9 rounded-full" onClick={() => setShowNotif(true)}>
              <BellIcon /><span className="absolute -top-0.5 -right-0.5 size-2.5 bg-destructive rounded-full border-2 border-background" />
            </Button>
            <Avatar className="size-9 hidden sm:flex border">
              <AvatarImage src="https://i.pravatar.cc/100?img=12" alt="user" />
              <AvatarFallback>AM</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {dataState === "OFFLINE" && (
          <div className="px-4 md:px-6 py-2 bg-[#F4B942]/10 border-b border-[#F4B942]/20 text-[12px] text-[#F4B942] flex items-center gap-2">
            <span className="size-1.5 bg-[#F4B942] rounded-full animate-pulse" /> Offline mode — showing latest available marine data.
            <Button variant="link" size="xs" onClick={() => setDataState("LIVE")} className="ml-auto text-[#F4B942] underline h-auto p-0">Retry</Button>
          </div>
        )}

        <main className="flex-1 min-w-0 bg-background pb-[72px] md:pb-0">{children}</main>

        {/* Mobile bottom nav — shadcn Button */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar border-t flex items-center justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Button key={href} variant="ghost" size="sm" className={`flex flex-col items-center gap-1 px-3 py-1.5 h-auto rounded-xl ${active ? "text-foreground bg-muted" : "text-muted-foreground"}`} onClick={() => router.push(href)}>
                <Icon active={active} /> <span className="text-[10px] font-medium tracking-[0.02em]">{label.split(" ")[0]}</span>
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Command palette — shadcn Dialog + Command */}
      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent className="p-0 gap-0 max-w-[560px] top-[20vh] translate-y-0 bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>Command palette</DialogTitle>
            <DialogDescription>Search marine intelligence</DialogDescription>
          </DialogHeader>
          <Command className="rounded-xl">
            <CommandInput placeholder="Ask about PFZ, SST, safety, routes…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Suggested queries">
                {[
                  "Where is the nearest Potential Fishing Zone today?",
                  "Is it safe to venture into the sea tomorrow morning?",
                  "What are the tide, weather and sea conditions near me?",
                  "Are there any cyclone or lightning alerts?",
                  "Which areas have high chlorophyll and favourable SST?",
                ].map(q => (
                  <CommandItem key={q} value={q} onSelect={() => { setShowSearch(false); router.push(`/assistant?q=${encodeURIComponent(q)}`); }} className="gap-2">
                    <span className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0"><SparkleIcon /></span> {q}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Location selector — shadcn Dialog */}
      <Dialog open={showLocation} onOpenChange={setShowLocation}>
        <DialogContent className="max-w-[420px] bg-card">
          <DialogHeader>
            <DialogTitle>Select location</DialogTitle>
            <DialogDescription>Search coast, port, or drop a pin on the map.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Search — e.g. Kochi, Veraval, Paradip" className="mt-2" />
          <div className="space-y-1">
            {[
              "Mumbai Harbour — 18.93°N, 72.90°E",
              "Alibaug — 18.64°N, 72.87°E",
              "Kochi — 9.96°N, 76.20°E",
              "Chennai — 13.10°N, 80.29°E",
            ].map(l => (
              <Button key={l} variant="ghost" className="w-full justify-start" onClick={() => setShowLocation(false)}>{l}</Button>
            ))}
          </div>
          <Button onClick={() => setShowLocation(false)} className="w-full">Confirm</Button>
        </DialogContent>
      </Dialog>

      {/* Notification drawer — shadcn Sheet */}
      <Sheet open={showNotif} onOpenChange={setShowNotif}>
        <SheetContent side="right" className="w-[380px] max-w-[92vw] bg-sidebar p-0">
          <SheetHeader className="p-5 pb-0">
            <SheetTitle>Alert Center</SheetTitle>
            <SheetDescription>Live marine alerts</SheetDescription>
          </SheetHeader>
          <div className="p-5 space-y-2">
            {[
              { t: "Increasing wind expected", d: "Eastern offshore • valid until 18:00", c: "#F4B942" },
              { t: "Favourable fishing — SW zone", d: "PFZ-001 • 32km SW", c: "#35C98A" },
              { t: "Lightning cells — west", d: "45km W • until 11:00", c: "#F4B942" },
            ].map(a => (
              <div key={a.t} className="p-3 rounded-xl bg-card border flex gap-3">
                <span className="size-2 rounded-full mt-1.5 shrink-0" style={{ background: a.c }} />
                <div><div className="text-sm font-medium">{a.t}</div><div className="text-xs text-muted-foreground">{a.d}</div></div>
              </div>
            ))}
          </div>
          <div className="p-5 pt-0">
            <Button className="w-full" onClick={() => { setShowNotif(false); router.push("/alerts"); }}>View all alerts</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Icons — thin stroke Hugeicons style (kept per spec Hugeicons primary)
function GridIcon({ active }: { active?: boolean }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#071014" : "currentColor"} strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>; }
function MapIcon({ active }: { active?: boolean }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#071014" : "currentColor"} strokeWidth="1.7"><path d="M1 6l7-3 8 3 7-3v14l-7 3-8-3-7 3z" /><path d="M8 3v14M16 6v14" /></svg>; }
function SparkleIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" /><path d="M19 13l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" /><path d="M5 14l1 1.5L7.5 16l-1.5 1-1 1.5-1-1.5L2.5 16 4 15.5z" /></svg>; }
function BellIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 9a6 6 0 0112 0c0 7-6 7-6 11H6s-6-4-6-11a6 6 0 016 0z" /><path d="M9 19a3 3 0 006 0" /></svg>; }
function RouteIcon({ active }: { active?: boolean }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#071014" : "currentColor"} strokeWidth="1.7"><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /><path d="M9.5 8.5l5 7M7 9.5l-1 5 5-1" /></svg>; }
function ChartIcon({ active }: { active?: boolean }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#071014" : "currentColor"} strokeWidth="1.7"><path d="M3 20V10M9 20V4M15 20v-8M21 20V12" /></svg>; }
function SettingsIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>; }
function GlobeIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" /></svg>; }
function UserIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" /></svg>; }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>; }
function ChevronDown() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9l6 6 6-6" /></svg>; }
