import GoalStore from '@/store/goals.store';
import ReportStore from '@/store/report.store';
import type { GoalFilters } from '@/types/filters.types';
import { toFixedDecimals } from '@/utils/fixed-decimals';
import { Goal, and, count, db, desc, eq, gt, gte, lt, lte } from 'astro:db';
import type { TGoal } from 'db/config';

export const ITEMS_PER_PAGE = 4;

type GetPaginatedGoalsParams = {
  userId: string;
  page?: number;
  filters?: GoalFilters;
};
export async function getCompletionRate(userId: string) {
  const cachedReport = ReportStore.get();
  if (cachedReport) return cachedReport;

  try {
    const goals = await db.select().from(Goal).where(eq(Goal.authorId, userId));
    const completedGoals = goals.filter((goal) => goal.completed);
    const lastWeekGoals = goals.filter((goal) => {
      return goal.completionDate && goal.completionDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    });
    const secondLastWeekGoals = goals.filter((goal) => {
      return (
        goal.completionDate &&
        goal.completionDate > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) &&
        goal.completionDate < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
    });
    const delta = lastWeekGoals.length - secondLastWeekGoals.length;
    const report = {
      completedCount: completedGoals.length,
      completionRate: toFixedDecimals(100 * (completedGoals.length / goals.length)),
      lastWeekGoalsCount: lastWeekGoals.length,
      totalGoalsCount: goals.length,
      deltaCount: delta
    };
    ReportStore.set(report);
    return report;
  } catch (error) {
    throw new Error('Cannot get completion rate');
  }
}

export async function getPaginatedGoals({ userId, page = 1, filters }: GetPaginatedGoalsParams): Promise<{
  countGoals: number;
  goals: TGoal[];
}> {
  const cachedGoals = GoalStore.getGoalsByPage(page);
  const cachedGoalsCount = GoalStore.getGoalsCount();
  if (cachedGoals && cachedGoalsCount) return { countGoals: cachedGoalsCount, goals: cachedGoals };

  try {
    const userFilter = eq(Goal.authorId, userId);
    const offset = (page - 1) * ITEMS_PER_PAGE;

    const conditions = [
      userFilter,
      filters?.fromDate ? gte(Goal.creationDate, new Date(filters.fromDate)) : undefined,
      filters?.toDate ? lte(Goal.creationDate, new Date(filters.toDate)) : undefined,
      filters?.category ? eq(Goal.categoryId, Number(filters.category)) : undefined,
      filters?.expired ? lt(Goal.dueDate, new Date()) : undefined,
      filters?.notExpired ? gt(Goal.dueDate, new Date()) : undefined,
      filters?.completed ? eq(Goal.completed, true) : undefined,
      filters?.notCompleted ? eq(Goal.completed, false) : undefined
    ].filter(Boolean);

    const getCountGoals = db
      .select({ count: count() })
      .from(Goal)
      .where(and(...conditions))
      .get();
    const getGoals = db
      .select()
      .from(Goal)
      .where(and(...conditions))
      .orderBy(desc(Goal.creationDate))
      .limit(ITEMS_PER_PAGE)
      .offset(offset);

    const calls = await Promise.all([getCountGoals, getGoals]);
    const countGoals = calls[0]?.count ?? 0;
    const goals = calls[1];
    GoalStore.set(page, ...goals);
    GoalStore.setGoalsCount(countGoals);

    return {
      countGoals,
      goals
    };
  } catch (error) {
    throw error;
  }
}
type getGoalByIdParams = {
  id: number;
  userId: string;
};
export async function getGoalById({ id, userId }: getGoalByIdParams) {
  const cachedGoal = GoalStore.getGoalById(id);
  if (cachedGoal) return cachedGoal;
  try {
    return await db
      .select()
      .from(Goal)
      .where(and(eq(Goal.id, Number(id)), eq(Goal.authorId, userId)))
      .get();
  } catch (error) {
    throw error;
  }
}

type GetGoalsByCategoryParams = {
  categoryId: number;
  userId: string;
  page?: number;
};
export function getGoalByCategoryId({ categoryId, userId, page = 1 }: GetGoalsByCategoryParams) {
  const getCategoriesCount = db
    .select({ count: count() })
    .from(Goal)
    .where(and(eq(Goal.categoryId, Number(categoryId)), eq(Goal.authorId, userId)))
    .get();
  const getGoalsByCategory = db
    .select()
    .from(Goal)
    .where(and(eq(Goal.categoryId, Number(categoryId)), eq(Goal.authorId, userId)))
    .orderBy(desc(Goal.creationDate))
    .limit(ITEMS_PER_PAGE)
    .offset((page - 1) * ITEMS_PER_PAGE);

  return {
    getCategoriesCount,
    getGoalsByCategory
  };
}
