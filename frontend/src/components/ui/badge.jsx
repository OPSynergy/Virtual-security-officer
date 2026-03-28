export function Badge({ className = "", variant = "default", ...props }) {
  const variants = {
    default: "border border-zinc-700 bg-zinc-800/80 text-zinc-300",
    success: "border border-emerald-500/30 bg-emerald-950/60 text-emerald-300",
    warning: "border border-amber-500/30 bg-amber-950/60 text-amber-300",
    danger: "border border-red-500/30 bg-red-950/60 text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${variants[variant] || variants.default} ${className}`}
      {...props}
    />
  );
}
