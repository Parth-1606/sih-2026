import { Badge } from "@/components/ui/badge";
import type { DataMode } from "@/lib/marine/schema";
import { DATA_MODE_LABEL } from "@/lib/marine/schema";
import { t, type Lang } from "@/lib/marine/i18n";

const STYLE: Record<DataMode, string> = {
  live: "bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/25",
  demo: "bg-[#F2C94C]/15 text-[#F2C94C] border-[#F2C94C]/25",
  forecast: "bg-[#4BA3FF]/15 text-[#4BA3FF] border-[#4BA3FF]/25",
  unavailable: "bg-muted text-muted-foreground border-border",
};

export default function DataBadge({ mode, lang = "en", stamp }: { mode: DataMode; lang?: Lang; stamp?: string }) {
  return (
    <Badge
      variant="outline"
      className={`${STYLE[mode]} text-[10px] gap-1`}
      title={stamp ? `Observed: ${stamp}` : DATA_MODE_LABEL[mode]}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {t(lang, `mode.${mode}`)}
      {stamp ? ` • ${stamp}` : ""}
    </Badge>
  );
}
