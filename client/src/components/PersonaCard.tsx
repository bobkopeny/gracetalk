import { type Persona } from "@shared/models/persona";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Trash2 } from "lucide-react";

interface PersonaCardProps {
  persona: Persona;
  onStartChat: (id: number) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}

export function PersonaCard({ persona, onStartChat, onDelete, compact = false }: PersonaCardProps) {
  return (
    <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-300 group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl font-display">{persona.name}</CardTitle>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity -mt-2 -mr-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(persona.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardDescription className="line-clamp-2">
          {persona.description}
        </CardDescription>
      </CardHeader>
      
      {!compact && (
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {persona.traits?.slice(0, 3).map((trait, i) => (
              <span key={i} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                {trait}
              </span>
            ))}
          </div>
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
