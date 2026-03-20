import { type Persona } from "@shared/models/persona";
import { XAI_VOICES } from "@shared/models/persona";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Trash2 } from "lucide-react";
import { useUpdatePersona } from "@/hooks/use-personas";

interface PersonaCardProps {
  persona: Persona;
  onStartChat: (id: number) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}

export function PersonaCard({ persona, onStartChat, onDelete, compact = false }: PersonaCardProps) {
  const updatePersona = useUpdatePersona();
  const currentVoice = persona.voice ?? "Aria";

  const handleVoiceChange = (voice: string) => {
    updatePersona.mutate({ id: persona.id, voice });
  };

  const voiceInfo = XAI_VOICES.find(v => v.id === currentVoice) ?? XAI_VOICES[0];

  return (
    <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-300 group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl font-display">{persona.name}</CardTitle>
          <div className="flex items-center gap-1 -mt-2 -mr-2">
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Voice:</span>
            <Select
              value={currentVoice}
              onValueChange={handleVoiceChange}
              disabled={updatePersona.isPending}
            >
              <SelectTrigger className="h-7 text-xs w-36 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {XAI_VOICES.map(v => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    {v.label} <span className="text-muted-foreground ml-1">({v.gender})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
