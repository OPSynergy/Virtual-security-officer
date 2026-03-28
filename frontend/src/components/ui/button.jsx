export function Button({ className = "", variant = "default", ...props }) {
  const variants = {
    default:
      "bg-gradient-to-b from-cyan-500 to-cyan-600 text-zinc-950 shadow-sm shadow-cyan-500/20 hover:from-cyan-400 hover:to-cyan-500",
    secondary:
      "border border-zinc-700 bg-zinc-800/80 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800",
    danger: "bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-900/30",
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant] || variants.default} ${className}`}
      {...props}
    />
  );
}
