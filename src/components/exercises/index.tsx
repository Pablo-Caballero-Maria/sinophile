"use client";
/** Picks the component for an exercise type. */
import type { Exercise } from "@/lib/exercises/types";
import { FlashcardExercise, IntroCard } from "./cards";
import { ChoiceExercise } from "./choice";
import type { ExerciseProps } from "./common";
import { MatchExercise } from "./match";
import { SpeakExercise } from "./speak";
import { TilesExercise } from "./tiles";
import { TypingExercise } from "./typing";
import { WriteExercise } from "./write";

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
