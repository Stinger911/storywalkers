export type StudentPathStep = {
  id: string;
  courseId?: string | null;
  title: string;
  description: string;
  materialUrl: string;
  order: number;
  isDone: boolean;
  isLocked: boolean;
  doneAt?: { toDate?: () => Date } | null;
  doneComment?: string | null;
  doneLink?: string | null;
};
