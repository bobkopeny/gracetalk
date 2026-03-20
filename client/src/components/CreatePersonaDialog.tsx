import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPersonaSchema, type InsertPersona, detectGenderFromName, XAI_VOICES } from "@shared/models/persona";
import { useCreatePersona } from "@/hooks/use-personas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function CreatePersonaDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createPersona = useCreatePersona();

  const form = useForm<InsertPersona>({
    resolver: zodResolver(insertPersonaSchema),
    defaultValues: {
      name: "",
      description: "",
      gender: "female",
      voice: "Aria",
    },
  });

  // Auto-detect voice from name
  const handleNameChange = (name: string) => {
    form.setValue("name", name);
    if (name.trim().length >= 2) {
      const detected = detectGenderFromName(name);
      form.setValue("gender", detected);
      form.setValue("voice", detected === "male" ? "Leo" : "Aria");
    }
  };

  function onSubmit(data: InsertPersona) {
    createPersona.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({
          title: "Persona created",
          description: "You can now practice witnessing with this persona.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create persona. Please try again.",
          variant: "destructive",
        });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
          <Plus className="w-4 h-4" />
          Create Persona
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New Persona</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Uncle Bob"
                      {...field}
                      onChange={(e) => handleNameChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Voice selector */}
            <FormField
              control={form.control}
              name="voice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voice</FormLabel>
                  <div className="grid grid-cols-5 gap-1.5">
                    {XAI_VOICES.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          field.onChange(v.id);
                          form.setValue("gender", v.gender);
                        }}
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-lg border py-2 px-1 text-xs font-medium transition-colors",
                          field.value === v.id
                            ? v.gender === "female"
                              ? "border-pink-400 bg-pink-50 text-pink-600"
                              : "border-blue-400 bg-blue-50 text-blue-600"
                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}
                      >
                        <span className="text-sm leading-none">{v.gender === "female" ? "♀" : "♂"}</span>
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-detected from name — you can change it</p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description & Beliefs</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe their worldview, resistance points, and personality..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createPersona.isPending}>
                {createPersona.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Persona"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
