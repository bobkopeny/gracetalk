import { Navigation, MobileHeader, MobileNav } from "@/components/Navigation";
import { GraduationCap, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const sections = [
  {
    title: "1. Why Share Your Faith?",
    content: `Jesus gave us the Great Commission — "Go and make disciples of all nations" (Matthew 28:19). Sharing our faith isn't optional for followers of Christ; it's part of who we are. But beyond obedience, it's an act of love. If we genuinely believe that Jesus is the way, the truth, and the life, staying silent when someone we care about doesn't know Him is not kindness — it's fear.

The good news is that God doesn't ask us to save people. He asks us to share. The Holy Spirit does the convicting and converting. Our job is simply to be faithful, present, and willing to have the conversation.

**Key Verse:** "For I am not ashamed of the gospel, because it is the power of God that brings salvation to everyone who believes." — Romans 1:16`,
  },
  {
    title: "2. Understanding the Gospel",
    content: `The gospel is not complicated, but it must be complete. Here are the four essential truths:

**God loves us and created us for relationship with Him.** (John 3:16)

**We have all sinned and separated ourselves from God.** "For all have sinned and fall short of the glory of God." (Romans 3:23). Sin isn't just "bad things" — it's living independent of God.

**Jesus paid the penalty for our sin.** "But God demonstrates his own love for us in this: While we were still sinners, Christ died for us." (Romans 5:8). His death was a substitution — He took what we deserved.

**We must respond personally by faith.** "If you declare with your mouth, 'Jesus is Lord,' and believe in your heart that God raised him from the dead, you will be saved." (Romans 10:9). Salvation is a gift — it cannot be earned, only received.`,
  },
  {
    title: "3. Share Your Own Story",
    content: `Your personal testimony is one of the most powerful tools you have. No one can argue with what happened to you. Keep it to three minutes and structure it simply:

**Before:** What was your life like before Jesus? What were you searching for, struggling with, or missing?

**How:** What happened? How did you come to faith? Was it gradual or a moment? Who or what was God using?

**After:** How has your life changed? Be specific and honest. Don't oversell — people can sense exaggeration. The small, real changes are often the most compelling.

Practice your testimony out loud. It should feel natural, not rehearsed. The goal is a real conversation, not a presentation.

**Key Verse:** "They triumphed over him by the blood of the Lamb and by the word of their testimony." — Revelation 12:11`,
  },
  {
    title: "4. Be Gracious, Not Argumentative",
    content: `"Always be prepared to give an answer to everyone who asks you to give the reason for the hope that you have. But do this with gentleness and respect." — 1 Peter 3:15

Winning an argument and winning a soul are very different things. Many people have been argued into a corner and walked away more hardened than when they started. Ask questions. Listen deeply. Understand their objections before responding. Often the stated objection ("I don't believe in miracles") is covering a deeper wound ("a pastor hurt me" or "I prayed and nothing happened").

When someone pushes back, resist the urge to immediately counter. Try: "That's a fair point — can you tell me more about why you feel that way?" You'll often learn the real issue, and you'll earn the trust to speak into it.`,
  },
  {
    title: "5. Give Them an Opportunity",
    content: `Many Christians have great conversations that never lead anywhere because they never ask the question. Don't let fear stop you from extending an invitation. At the right moment — after you've listened, shared, and answered questions — ask something like:

*"Is there anything stopping you from making that decision today?"*
*"Would you like to pray and invite Jesus into your life right now?"*
*"Does what we've been talking about make sense to you?"*

Some people are closer to the kingdom than they appear. A simple, gentle invitation at the right moment can be the hinge point of their eternity. Trust the Holy Spirit to tell you when the moment is right.`,
  },
  {
    title: "6. Always Offer to Pray",
    content: `Even if someone isn't ready to commit, offer to pray for them. Prayer is an act of love, and most people — even skeptics — will accept it. Saying "Can I pray for you right now, about that situation you mentioned?" moves from conversation to experience.

You can also pray *for* someone without them present. Prayer is not passive — it's inviting God into someone else's story. Stay consistent in praying for the people in your life who don't yet know Jesus. Keep a list if it helps.

**Key Verse:** "The prayer of a righteous person is powerful and effective." — James 5:16`,
  },
  {
    title: "7. Using GraceTalk to Practice",
    content: `GraceTalk exists because confidence in witnessing comes from practice. The app lets you have real conversations with AI personas who think, respond, and push back the way real people do — without the stakes of a real relationship on the line.

**How to use it well:**
- Pick a persona that represents someone in your life or a type you find difficult.
- Have the full conversation — don't just give up when it gets hard.
- After the session, read the feedback carefully. The coaching is specific to what you said and how this persona responded.
- Use the Help button mid-conversation if you get stuck — it gives you a one-line tactical suggestion in real time.
- Practice a persona repeatedly until you feel natural. Try different approaches.

The goal isn't to memorize scripts — it's to become so familiar with the truth and with listening well that you can respond naturally in any conversation.`,
  },
];

function AccordionItem({ title, content, isOpen, onToggle }: {
  title: string;
  content: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left bg-card hover:bg-muted/30 transition-colors"
      >
        <span className="font-semibold text-foreground">{title}</span>
        <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 bg-card border-t border-border/50">
          <div className="pt-4 prose prose-sm prose-slate max-w-none text-muted-foreground leading-relaxed">
            {content.split("\n\n").map((para, i) => {
              if (para.startsWith("**") && para.endsWith("**")) {
                return <p key={i} className="font-semibold text-foreground">{para.replace(/\*\*/g, "")}</p>;
              }
              // Render bold inline text
              const parts = para.split(/\*\*(.*?)\*\*/g);
              return (
                <p key={i}>
                  {parts.map((part, j) =>
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                  )}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Training() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <Navigation />
      <MobileHeader />

      <main className="md:pl-64">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 animate-in space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Training Guide</h1>
              <p className="text-sm text-muted-foreground">How to share your faith with confidence</p>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm text-primary/80">
            Work through these sections to build a foundation before practicing with AI personas. Come back here whenever you need a refresher.
          </div>

          <div className="space-y-3">
            {sections.map((section, i) => (
              <AccordionItem
                key={i}
                title={section.title}
                content={section.content}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
