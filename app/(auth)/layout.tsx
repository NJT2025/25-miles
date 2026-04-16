export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f5f0] px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: "#333331" }}
        >
          25
        </div>
        <span className="text-sm text-stone-500 tracking-wide uppercase">Miles</span>
      </div>
      {children}
    </div>
  )
}
