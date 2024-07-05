import { clearGoals } from '@/store/goals.store';
import { type GoalInsertPayload } from '@/types/goal.types';
import { Goal, and, db, eq } from 'astro:db';

export function createGoal(data: GoalInsertPayload) {
  clearGoals();
  return db.insert(Goal).values({
    description: data.description ?? '',
    creationDate: new Date(),
    updateDate: new Date(),
    ...data,
    completed: !!data.completionDate
  });
}

type UpdateGoalPayload = Omit<GoalInsertPayload, 'authorId' | 'authorName'> & {
  userId: string;
  goalId: number;
};
export function updateGoal(data: UpdateGoalPayload) {
  clearGoals();
  const { completionDate } = data;
  return db
    .update(Goal)
    .set({
      ...data,
      completed: !!completionDate
    })
    .where(and(eq(Goal.authorId, data.userId), eq(Goal.id, data.goalId)))
    .returning()
    .get();
}
