import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MapPin, Leaf, Users, Building2 } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f5f0]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: "#333331" }}
          >
            25
          </div>
          <span className="font-semibold text-stone-700">Miles</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-stone-500 bg-stone-100 px-3 py-1.5 rounded-full mb-6">
          <Leaf className="w-3.5 h-3.5 text-green-700" />
          Reduce embodied carbon · Support local economies
        </div>

        <h1 className="text-5xl font-bold text-stone-800 mb-6 leading-tight">
          Source materials and makers<br />
          <span style={{ color: "#4a7c59" }}>within 25 miles</span> of your project
        </h1>

        <p className="text-xl text-stone-500 mb-10 max-w-2xl mx-auto">
          A resource platform for architects to find local stone quarries, timber
          suppliers, craftspeople, and contractors — reducing transport miles and
          supporting regional building traditions.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/register">Start searching</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
        <FeatureCard
          icon={<MapPin className="w-6 h-6 text-green-700" />}
          title="Radius search"
          description="Set your project postcode and radius. We search for verified local suppliers, manufacturers, and makers within your specified distance."
        />
        <FeatureCard
          icon={<Users className="w-6 h-6 text-amber-700" />}
          title="Materials & craftspeople"
          description="From stone quarries and brickworks to stonemasons, lime plasterers, and timber framers — organised by category and distance."
        />
        <FeatureCard
          icon={<Building2 className="w-6 h-6 text-slate-700" />}
          title="Project-based"
          description="Organise searches by project. Save the suppliers you want to follow up with. Export a shortlist for your project file."
        />
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 px-6 py-8 text-center text-sm text-stone-400">
        <p>
          25 Miles — built by{" "}
          <a
            href="https://tonicarchitecture.co.uk"
            className="hover:text-stone-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tonic Architecture
          </a>
        </p>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-100">
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-stone-800 mb-2">{title}</h3>
      <p className="text-sm text-stone-500">{description}</p>
    </div>
  )
}
