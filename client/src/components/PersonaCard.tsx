import { type Persona } from "@shared/models/persona";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Trash2, Venus, Mars } from "lucide-react";
import { useUpdatePersona } from "@/hooks/use-personas";
import { cn } from "@/lib/utils";

interface PersonaCardProps {
  persona: Persona;
  onStartChat: (id: number) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}

export function PersonaCard({ persona, onStartChat, onDelete, compact = false }: PersonaCardProps) {
  const updatePersona = useUpdatePersona();
  const gender = persona.gender ?? "female";

  const toggleGender = (e: React.MouseEvent) => {
    e.stopPropagation();
    updatePersona.mutate({ id: persona.id, gender: gender === "female" ? "male" : "female" });
  };

  return (
    <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-300 group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl font-display">{persona.name}</CardTitle>
          <div className="flex items-center gap-1 -mt-2 -mr-2">
            {/* Gender toggle */}
            <Button
              variant="ghost"
              size="icon"
              title={`Voice: ${gender === "female" ? "Eve (female)" : "Rex (male)"} — click to toggle`}
              onClick={toggleGender}
              disabled={updatePersona.isPending}
              className={cn(
                "transition-colors",
                gender === "female"
                  ? "text-pink-500 hover:text-pink-600 hover:bg-pink-50"
                  : "text-blue-500 hover:text-blue-600 hover:bg-blue-50"
              )}
            >
              {gender === "female" ? <Venus className="w-4 h-4" /> : <Mars className="w-4 h-4" />}
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(persona.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="line-clamp-2">
          {persona.description}
        </CardDescription>
      </CardHeader>

      {!compact && (
        <CardContent>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {gender === "female" ? (
              <Venus className="w-3 h-3 text-pink-400" />
            ) : (
              <Mars className="w-3 h-3 text-blue-400" />
            )}
            Voice: <span className="font-medium">{gender === "female" ? "Eve (female)" : "Rex (male)"}</span>
          </p>
        </CardContent>
      )}

      <CardFooter>
        <Button
          onClick={() => onStartChat(persona.id)}
          className="w-full gap-2 shadow-sm group-hover:shadow-md transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          Start Practice
        </Button>
      </CardFooter>
    </Card>
  );
}
