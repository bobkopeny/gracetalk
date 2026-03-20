import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, MessageCircle, Heart, ArrowRight, Play } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const DEMO_PERSONAS = [
  { id: "open-heart", name: "The Open Heart", tagline: "Spiritually curious, open to exploring faith" },
  { id: "spiritual-agnostic", name: "The Spiritual Agnostic", tagline: "Spiritual but not religious — all paths lead somewhere" },
  { id: "professional", name: "The Professional", tagline: "Too busy for religion, but open to relevance" },
  { id: "hurt-by-church", name: "Hurt by the Church", tagline: "Wounded by Christians, guarded but not closed" },
  { id: "skeptical-atheist", name: "The Skeptical Atheist", tagline: "Evidence-based, ready to debate respectfully" },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-xl text-primary">GraceTalk</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="default">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative py-20 lg:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-8 animate-in">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight">
                Practice Sharing Your Faith with <span className="text-primary">Confidence</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed font-light">
                Simulate conversations with diverse personas, receive biblical coaching, and grow in your ability to witness for Christ.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                {user ? (
                  <Link href="/dashboard">
                    <Button size="lg" className="rounded-full px-8 h-12 text-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                      Start Practicing <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/login">
                    <Button size="lg" className="rounded-full px-8 h-12 text-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                      Get Started <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Try it free */}
        <section className="py-20 bg-muted/30 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 space-y-3">
              <h2 className="text-3xl font-display font-bold text-foreground">
                Try It Free — No Account Needed
              </h2>
              <p className="text-muted-foreground text-lg">
                Pick a persona and start a practice conversation right now.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {DEMO_PERSONAS.map((persona) => (
                <Link key={persona.id} href={`/demo/${persona.id}`}>
                  <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold mb-4 group-hover:bg-primary/20 transition-colors">
                      {persona.name[0]}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{persona.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{persona.tagline}</p>
                    <div className="flex items-center gap-2 text-primary text-sm font-medium">
                      <Play className="w-4 h-4" /> Start conversation
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              <FeatureCard 
                icon={MessageCircle}
                title="Realistic Dialogues"
                description="Chat with AI personas tailored to specific worldviews—atheist, agnostic, or seeker."
              />
              <FeatureCard 
                icon={Shield}
                title="Safe Environment"
                description="Make mistakes and learn without pressure. A judgment-free zone to practice."
              />
              <FeatureCard 
                icon={Heart}
                title="Biblical Feedback"
                description="Receive gentle coaching and scripture suggestions to improve your witness."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} GraceTalk. Soli Deo Gloria.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold font-display mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
