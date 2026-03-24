import { type Persona, XAI_VOICES, DIFFICULTY_CONFIG } from "@shared/models/persona";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Trash2, Lock } from "lucide-react";
import { useUpdatePersona } from "@/hooks/use-personas";
import { cn } from "@/lib/utils";

interface PersonaCardProps {
  persona: Persona;
  onStartChat: (id: number) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
  progress?: { bestScore: number; passed: boolean; attempts: number };
  locked?: boolean;
  unlocksAtLevel?: number;
}

export function PersonaCard({ persona, onStartChat, onDelete, compact = false, progress, locked = false, unlocksAtLevel }: PersonaCardProps) {
  const updatePersona = useUpdatePersona();
  const currentVoice = persona.voice ?? "Aria";

  const handleVoiceChange = (voice: string) => {
    updatePersona.mutate({ id: persona.id, voice });
  };

  const difficulty = (persona.difficulty ?? 3) as 1 | 2 | 3 | 4 | 5;
  const diffConfig = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG[3];

  return (
    <Card className={cn(
      "transition-all duration-300 group relative overflow-hidden",
      locked ? "opacity-60 grayscale" : "hover:shadow-lg hover:border-primary/20"
    )}>
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-display">{persona.name}</CardTitle>
            <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${diffConfig.tagColor}`}>
              {"★".repeat(diffConfig.stars)}{"☆".repeat(5 - diffConfig.stars)} {diffConfig.label}
            </span>
            {progress && progress.attempts > 0 && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {progress.passed && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    ✓ Passed
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  Best: {progress.bestScore}/100 · {progress.attempts} {progress.attempts === 1 ? "try" : "tries"}
                </span>
              </div>
            )}
          </div>
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
          <CardDescription className="line-clamp-2 mt-1">
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
        {locked ? (
          <Button disabled className="w-full gap-2 opacity-50 cursor-not-allowed">
            <Lock className="w-4 h-4" />
            {unlocksAtLevel ? `Complete Level ${unlocksAtLevel - 1} to Unlock` : "Locked"}
          </Button>
        ) : (
          <Button
            onClick={() => onStartChat(persona.id)}
            className="w-full gap-2 shadow-sm group-hover:shadow-md transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Start Practice
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
