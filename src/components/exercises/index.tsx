"use client";
/** Picks the component for an exercise type. */
import type { Exercise } from "@/lib/exercises/types";
import { FlashcardExercise, IntroCard } from "./Cards";
import { ChoiceExercise } from "./Choice";
import type { ExerciseProps } from "./Common";
import { MatchExercise } from "./Match";
import { SpeakExercise } from "./Speak";
import { TilesExercise } from "./Tiles";
import { TypingExercise } from "./Typing";
import { WriteExercise } from "./Write";

export function ExerciseView(props: ExerciseProps<Exercise>) {
  const { exercise } = props;
  switch (exercise.type) {
    case "intro":
      return <IntroCard {...props} exercise={exercise} />;
    case "choice":
      return <ChoiceExercise {...props} exercise={exercise} />;
    case "match":
      return <MatchExercise {...props} exercise={exercise} />;
    case "tiles":
      return <TilesExercise {...props} exercise={exercise} />;
    case "typing":
      return <TypingExercise {...props} exercise={exercise} />;
    case "write":
      return <WriteExercise {...props} exercise={exercise} />;
    case "speak":
      return <SpeakExercise {...props} exercise={exercise} />;
    case "flashcard":
      return <FlashcardExercise {...props} exercise={exercise} />;
  }
}
