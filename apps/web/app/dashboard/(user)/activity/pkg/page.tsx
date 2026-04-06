import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { registryFetch } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Package Detail — better-npm",
};

interface VersionGroup {
  filename: string;
  install_count: number;
  last_installed: number;
  first_installed: number;
  version_status: string;
}

interface RecentInstall {
  filename: string;
  cache_hit: number;
  created_at: number;
  version_status: string;
}

interface ReviewVersion {
  id: string;
  version: string;
  status: string;
}

interface PackageDetail {
  package_name: string;
  total_installs: number;
  first_installed: number | null;
  last_installed: number | null;
  versions: VersionGroup[];
  recent: RecentInstall[];
  tracked: {
    weekly_downloads: number;
    description: string | null;
    latest_known: string | null;
  } | null;
  review_status: ReviewVersion[];
  is_blocked: boolean;
}

export default async function PackageDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const email = session?.user?.email;
  const params = await searchParams;
  const packageName = params.name;

  if (!packageName) redirect("/dashboard/activity");

  const data: PackageDetail | null = email
    ? await registryFetch(
        `/api/internal/user/packages/detail?email=${encodeURIComponent(email)}&name=${encodeURIComponent(packageName)}`,
      ).catch(() => null)
    : null;

  if (!data) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/activity"
          className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
        >
          ← Back to packages
        </Link>
        <div className="rounded border border-dashed border-foreground/[0.08] px-6 py-12 text-center">
          <p className="text-sm text-foreground/30">Package not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/activity"
            className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
          >
            ← Back to packages
          </Link>
          <h2 className="mt-2 text-lg font-medium font-mono">
            {data.package_name}
          </h2>
          {data.tracked?.description && (
            <p className="mt-1 text-sm text-foreground/40 max-w-xl">
              {data.tracked.description}
            </p>
          )}
        </div>
        {data.is_blocked && (
          <span className="shrink-0 font-mono text-[10px] px-2 py-1 rounded border bg-red-500/10 text-red-400/80 border-red-500/15">
            blocked
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <MiniStat
          label="Total installs"
          value={data.total_installs.toLocaleString()}
        />
        <MiniStat
          label="Versions used"
          value={String(data.versions.length)}
        />
        {data.tracked && (
          <MiniStat
            label="Weekly downloads"
            value={formatCompact(data.tracked.weekly_downloads)}
            detail="on npm"
          />
        )}
        {data.tracked?.latest_known && (
          <MiniStat
            label="Latest reviewed"
            value={data.tracked.latest_known}
          />
        )}
        {!data.tracked && (
          <>
            <MiniStat
              label="First installed"
              value={data.first_installed ? formatDate(data.first_installed) : "—"}
            />
            <MiniStat
              label="Last installed"
              value={data.last_installed ? formatRelative(data.last_installed) : "—"}
            />
          </>
        )}
      </div>

      {/* Version breakdown */}
      <div className="rounded border border-foreground/[0.08] overflow-hidden">
        <div className="border-b border-foreground/[0.06] bg-foreground/[0.02] px-5 py-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-foreground/40">
            Versions installed
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/[0.06]">
              <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-foreground/30 font-normal">
                Version
              </th>
              <th className="text-right px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-foreground/30 font-normal">
                Installs
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-foreground/30 font-normal">
                Status
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-foreground/30 font-normal">
                Last used
              </th>
            </tr>
          </thead>
          <tbody>
            {data.versions.map((v) => {
              const version = extractVersion(v.filename);
              return (
                <tr
                  key={v.filename}
                  className="border-b border-foreground/[0.04] last:border-0 hover:bg-foreground/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-[13px]">
                    {version || v.filename}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums text-foreground/50">
                    {v.install_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={v.version_status} />
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-foreground/30">
                    {formatRelative(v.last_installed)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Review status (for tracked packages) */}
      {data.review_status.length > 0 && (
        <div className="rounded border border-foreground/[0.08] overflow-hidden">
          <div className="border-b border-foreground/[0.06] bg-foreground/[0.02] px-5 py-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-foreground/40">
              Review status
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px bg-foreground/[0.04]">
            {data.review_status.map((rv) => (
              <div key={rv.id} className="bg-background px-4 py-3">
                <p className="font-mono text-[13px]">{rv.version}</p>
                <div className="mt-1">
                  <StatusBadge status={rv.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent install timeline */}
      <div className="rounded border border-foreground/[0.08] overflow-hidden">
        <div className="border-b border-foreground/[0.06] bg-foreground/[0.02] px-5 py-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-foreground/40">
            Recent installs
          </h3>
        </div>
        <div className="divide-y divide-foreground/[0.04]">
          {data.recent.map((r, i) => {
            const version = extractVersion(r.filename);
            return (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-foreground/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] text-foreground/50">
                    {version || r.filename}
                  </span>
                  {r.cache_hit === 1 && (
                    <span className="text-[10px] font-mono text-foreground/20 border border-foreground/[0.06] rounded px-1 py-0.5">
                      cached
                    </span>
                  )}
                </div>
                <span className="text-[13px] text-foreground/30 whitespace-nowrap">
                  {formatRelative(r.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border border-foreground/[0.08] rounded px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-foreground/30">
        {label}
      </p>
      <p className="mt-1 text-base font-medium tabular-nums truncate">
        {value}
      </p>
      {detail && (
        <p className="text-[10px] text-foreground/25 mt-0.5">{detail}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    approved: {
      label: "approved",
      classes: "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/15",
    },
    pending: {
      label: "pending",
      classes: "bg-amber-500/10 text-amber-400/80 border-amber-500/15",
    },
    rejected: {
      label: "rejected",
      classes: "bg-red-500/10 text-red-400/80 border-red-500/15",
    },
    blocked: {
      label: "blocked",
      classes: "bg-red-500/10 text-red-400/80 border-red-500/15",
    },
    under_review: {
      label: "reviewing",
      classes: "bg-blue-500/10 text-blue-400/80 border-blue-500/15",
    },
    unreviewed: {
      label: "unreviewed",
      classes:
        "bg-foreground/[0.04] text-foreground/30 border-foreground/[0.08]",
    },
  };
  const c = config[status] || config.unreviewed;
  return (
    <span
      className={`inline-block font-mono text-[10px] px-1.5 py-0.5 rounded border ${c.classes}`}
    >
      {c.label}
    </span>
  );
}

function extractVersion(filename: string): string | null {
  const match = filename.match(/-(\d+\.\d+\.\d+[^.]*)\.tgz$/);
  return match ? match[1] : null;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
