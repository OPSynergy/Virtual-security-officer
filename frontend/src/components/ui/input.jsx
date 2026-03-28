export function Input({ className = "", ...props }) {
  return (
    <input
      className={`h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 ${className}`}
      {...props}
    />
  );
}
