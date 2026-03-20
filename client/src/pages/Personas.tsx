import { usePersonas, useDeletePersona, useCreatePersona } from "@/hooks/use-personas";
import { useCreateConversation } from "@/hooks/use-conversations";
import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { PersonaCard } from "@/components/PersonaCard";
import { CreatePersonaDialog } from "@/components/CreatePersonaDialog";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useState } from "react";

export default function Personas() {
  const { data: personas, isLoading } = usePersonas();
  const createConversation = useCreateConversation();
  const deletePersona = useDeletePersona();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleStartChat = (personaId: number) => {
    createConversation.mutate(personaId, {
      onSuccess: (data) => setLocation(`/chat/${data.id}`),
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deletePersona.mutate(deleteId, {
        onSuccess: () => {
          setDeleteId(null);
          toast({ title: "Persona deleted" });
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">My Personas</h1>
              <p className="text-muted-foreground mt-1">Manage the profiles you practice with.</p>
            </div>
            <CreatePersonaDialog />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {personas?.map((persona) => (
                <PersonaCard 
                  key={persona.id} 
                  persona={persona} 
                  onStartChat={handleStartChat}
                  onDelete={setDeleteId}
                />
              ))}
            </div>
          )}

          {!isLoading && personas?.length === 0 && (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground mb-4">You don't have any personas yet.</p>
              <CreatePersonaDialog />
            </div>
          )}
        </div>
      </main>
      
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this persona. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <MobileNav />
    </div>
  );
}
