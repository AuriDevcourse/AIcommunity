// Lets schedule.json name a Lucide icon per topic-flow step as a plain string.
// Keep this map small and intentional; iconFor falls back to a neutral icon.
import {
  Video, Laptop, AudioLines, Users, Megaphone, FileText, Sparkles,
  ListChecks, Mic, Share2, Bot, Wand2, Newspaper, Presentation, MessagesSquare,
} from 'lucide-react';

export const TOPIC_ICONS = {
  Video, Laptop, AudioLines, Users, Megaphone, FileText, Sparkles,
  ListChecks, Mic, Share2, Bot, Wand2, Newspaper, Presentation, MessagesSquare,
};

export const iconFor = (name) => TOPIC_ICONS[name] || ListChecks;
