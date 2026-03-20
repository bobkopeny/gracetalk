import { useConversations } from "@/hooks/use-conversations";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function History() {
  const { data: conversations, isLoading } = useConversations();

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-in">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground">Practice History</h1>
            <p className="text-muted-foreground mt-1">Review your past conversations and feedback.</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {conversations?.map((conv) => (
                <Card key={conv.id} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold shrink-0">
                        {conv.personaName?.[0]}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{conv.personaName}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(conv.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Link href={`/chat/${conv.id}`} className="flex-1 sm:flex-none">
                         <Button variant="outline" className="w-full">View Chat</Button>
                      </Link>
                      <Link href={`/feedback/${conv.id}`} className="flex-1 sm:flex-none">
                        <Button className="w-full">View Feedback</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && conversations?.length === 0 && (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground mb-4">No history yet.</p>
              <Link href="/dashboard"><Button>Start Practice</Button></Link>
            </div>
          )}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
