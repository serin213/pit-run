export interface MessageEntry {
  readonly id: string;
  readonly message: string;
  readonly variables?: readonly string[];
}

export const MESSAGES = {
  overall_pb: [
    { id: 'overall_pb_01', message: 'New personal best. Incredible run.' },
    { id: 'overall_pb_02', message: "Fastest you've ever been." },
    { id: 'overall_pb_03', message: "That's a record, mate. Well done." },
    { id: 'overall_pb_04', message: 'You just beat yourself. Huge.' },
  ],
  circuit_pb: [
    { id: 'circuit_pb_01', message: 'Best time on this route. You own it.' },
    { id: 'circuit_pb_02', message: 'New record for this circuit.' },
    { id: 'circuit_pb_03', message: 'This track suits you.' },
  ],
  goal_hit: [
    { id: 'goal_hit_01', message: 'Target hit. Great work.' },
    { id: 'goal_hit_02', message: 'Exactly the plan. Clean run.' },
    { id: 'goal_hit_03', message: 'Perfect race, mate. Take a good rest.' },
    { id: 'goal_hit_04', message: 'Clean run from start to finish.' },
  ],
  goal_missed: [
    { id: 'goal_missed_01', message: "Tough day, but you crossed the line. That's a win." },
    { id: 'goal_missed_02', message: 'Pace was good. Results will come.' },
    { id: 'goal_missed_03', message: 'Reset and go again next time, mate.' },
    { id: 'goal_missed_04', message: "You showed up. That's what matters." },
  ],
  consistent_pace: [
    { id: 'consistent_pace_01', message: 'Same pace every kilometer. Incredible control.' },
    { id: 'consistent_pace_02', message: 'Steady from start to finish.' },
    { id: 'consistent_pace_03', message: 'No slowdowns, no sudden bursts.' },
  ],
  fade: [
    { id: 'fade_01', message: 'Energy dropped at the end. More endurance work.' },
    { id: 'fade_02', message: 'Strong start, tough finish. Pace it next time.' },
    { id: 'fade_03', message: 'Pace dropped in the final stretch. Next time we hold it longer.' },
  ],
  negative_split: [
    { id: 'negative_split_01', message: 'You got faster as you went. Brilliant, mate.' },
    { id: 'negative_split_02', message: 'Second half faster than the first. Brilliant, mate.' },
    { id: 'negative_split_03', message: 'Strong finish. You sped up at the end.' },
  ],
  tyre_strategy_hit: [
    { id: 'tyre_strategy_hit_01', message: 'Paced it exactly right.' },
    { id: 'tyre_strategy_hit_02', message: 'Smart run, mate. Controlled from the start.' },
    { id: 'tyre_strategy_hit_03', message: 'Right effort, right time.' },
  ],
  wet_tyre: [
    { id: 'wet_tyre_01', message: 'Easy day on wets. Recovery matters too, mate.' },
    { id: 'wet_tyre_02', message: 'Light run today. Keep the body fresh.' },
    { id: 'wet_tyre_03', message: 'Nice and easy. Smart way to stay consistent.' },
    { id: 'wet_tyre_04', message: 'Recovery pace on wets. Long season ahead.' },
  ],
  promotion_close: [
    { id: 'promotion_close_01', message: 'Your pace is close to {next_grade}.', variables: ['next_grade'] },
    { id: 'promotion_close_02', message: 'Keep this pace up and {next_grade} is yours.', variables: ['next_grade'] },
    { id: 'promotion_close_03', message: 'Pace like that belongs in {next_grade}.', variables: ['next_grade'] },
  ],
  streak: [
    { id: 'streak_01', message: '{n} days in a row. That\'s discipline.', variables: ['n'] },
    { id: 'streak_02', message: '{n}-day streak. This is the work.', variables: ['n'] },
    { id: 'streak_03', message: "Back again. Consistency wins." },
  ],
  dawn: [
    { id: 'dawn_01', message: "Before sunrise and you're running. Committed." },
    { id: 'dawn_02', message: "Dawn run. The road's all yours." },
    { id: 'dawn_03', message: 'Early start, mate. Real dedication.' },
  ],
  morning: [
    { id: 'morning_01', message: 'Morning miles. Best way to start the day.' },
    { id: 'morning_02', message: "Out while the city's still waking up. Smart." },
    { id: 'morning_03', message: 'Fresh legs, fresh air. Perfect timing.' },
  ],
  evening: [
    { id: 'evening_01', message: 'Evening run to close the day. Nice job, mate.' },
    { id: 'evening_02', message: 'Sunset miles. Great end of the day.' },
    { id: 'evening_03', message: 'Work done, miles done. Nice day.' },
  ],
  night: [
    { id: 'night_01', message: 'Late night miles. Nobody else is up.' },
    { id: 'night_02', message: "{time} on the clock and you're out here. Committed.", variables: ['time'] },
    { id: 'night_03', message: 'Quiet roads, just you. Respect.' },
  ],
  first_race: [
    { id: 'first_race_01', message: 'First run done. Welcome, mate.' },
    { id: 'first_race_02', message: "You started. That's the hardest part." },
    { id: 'first_race_03', message: 'Day one. Long road ahead.' },
  ],
  milestone_race: [
    { id: 'milestone_race_01', message: "Race #{n}. You're getting stronger every time.", variables: ['n'] },
    { id: 'milestone_race_02', message: '{n} races complete. Real momentum now.', variables: ['n'] },
    { id: 'milestone_race_03', message: '{n} races in the books, mate.', variables: ['n'] },
  ],
  comeback: [
    { id: 'comeback_01', message: 'Back after {n} days. Good to have you.', variables: ['n'] },
    { id: 'comeback_02', message: "You came back. That's everything." },
  ],
} as const satisfies Record<string, readonly MessageEntry[]>;

export type MessageCategoryKey = keyof typeof MESSAGES;
