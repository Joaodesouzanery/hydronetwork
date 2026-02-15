import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { TutorialDialog } from "./TutorialDialog";
import { getTutorial } from "@/data/tutorialData";

interface PageTutorialButtonProps {
  pageKey: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function PageTutorialButton({ 
  pageKey, 
  variant = "outline", 
  size = "default",
  className 
}: PageTutorialButtonProps) {
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorial = getTutorial(pageKey);

  if (!tutorial) return null;

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        onClick={() => setShowTutorial(true)}
        className={className}
      >
        <BookOpen className="h-4 w-4 mr-2" />
        Tutorial
      </Button>

      <TutorialDialog
        open={showTutorial}
        onOpenChange={setShowTutorial}
        title={tutorial.title}
        steps={tutorial.steps}
      />
    </>
  );
}
