import { Route, Router } from "@solidjs/router";
import "./App.css";
import { AdminLayout } from "./routes/admin/AdminLayout.tsx";
import { AdminCategories } from "./routes/admin/AdminCategories.tsx";
import { AdminHome } from "./routes/admin/AdminHome.tsx";
import { AdminGoals } from "./routes/admin/AdminGoals.tsx";
import { AdminStepTemplates } from "./routes/admin/AdminStepTemplates.tsx";
import { AdminStudentProfile } from "./routes/admin/AdminStudentProfile.tsx";
import { AdminStudents } from "./routes/admin/AdminStudents.tsx";
import { AdminQuestions } from "./routes/admin/AdminQuestions.tsx";
import { AdminQuestionDetail } from "./routes/admin/AdminQuestionDetail.tsx";
import { AdminStepCompletions } from "./routes/admin/AdminStepCompletions.tsx";
import { Landing } from "./routes/Landing.tsx";
import { Login } from "./routes/Login.tsx";
import { NotFound } from "./routes/NotFound.tsx";
import { StudentLayout } from "./routes/student/StudentLayout.tsx";
import { StudentProfile, StudentProfileRail } from "./routes/student/StudentProfile.tsx";
import { StudentHomeRoute } from "./routes/student/StudentHomeRoute.tsx";
import { StudentQuestionDetail } from "./routes/student/StudentQuestionDetail.tsx";
import { StudentQuestionNew } from "./routes/student/StudentQuestionNew.tsx";
import { StudentQuestions } from "./routes/student/StudentQuestions.tsx";
import { RailCard } from "./components/ui/rail-card.tsx";
import { Card, CardContent, CardTitle } from "./components/ui/card.tsx";
import { Illustration } from "./components/ui/illustration.tsx";
import { Toaster } from "./components/ui/toast.tsx";
import { useI18n } from "./lib/i18n.tsx";
import { StudentLibrary } from "./routes/student/StudentLibrary.tsx";
import { StudentLibraryDetail } from "./routes/student/StudentLibraryDetail.tsx";
import { AdminLibrary } from "./routes/admin/AdminLibrary.tsx";
import { AdminLibraryDetail } from "./routes/admin/AdminLibraryDetail.tsx";
import { OnboardingGoal } from "./routes/onboarding/OnboardingGoal.tsx";
import { OnboardingProfile } from "./routes/onboarding/OnboardingProfile.tsx";
import { OnboardingCourses } from "./routes/onboarding/OnboardingCourses.tsx";
import { OnboardingCheckout } from "./routes/onboarding/OnboardingCheckout.tsx";
import { Blocked } from "./routes/Blocked.tsx";

const AdminHomeRoute = () => (
  <AdminLayout>
    <AdminHome />
  </AdminLayout>
);

const AdminStudentsRoute = () => (
  <AdminLayout>
    <AdminStudents />
  </AdminLayout>
);

const AdminStudentProfileRoute = () => (
  <AdminLayout>
    <AdminStudentProfile />
  </AdminLayout>
);

const AdminCategoriesRoute = () => (
  <AdminLayout>
    <AdminCategories />
  </AdminLayout>
);

const AdminGoalsRoute = () => (
  <AdminLayout>
    <AdminGoals />
  </AdminLayout>
);

const AdminStepTemplatesRoute = () => (
  <AdminLayout>
    <AdminStepTemplates />
  </AdminLayout>
);

const AdminQuestionsRoute = () => (
  <AdminLayout>
    <AdminQuestions />
  </AdminLayout>
);

const AdminQuestionDetailRoute = () => (
  <AdminLayout>
    <AdminQuestionDetail />
  </AdminLayout>
);

const AdminStepCompletionsRoute = () => (
  <AdminLayout>
    <AdminStepCompletions />
  </AdminLayout>
);

const StudentProfileRoute = () => (
  <StudentLayout rightRail={<StudentProfileRail />}>
    <StudentProfile />
  </StudentLayout>
);

const StudentQuestionsRail = () => {
  const { t } = useI18n();
  return (
    <>
      <Card class="border border-border/70">
        <CardTitle class="p-3">
          <Illustration
            src="/illustrations/rail-hero.png"
            alt={t("student.questionsRail.illustrationAlt")}
            class="h-32 w-full rounded-[var(--radius-lg)] no-border"
          />
        </CardTitle>
        <CardContent class="p-3 flex flex-col gap-3">
          
      <RailCard title={t("student.questionsRail.tipsTitle")}>
        <ul class="space-y-2 text-xs text-muted-foreground">
          <li>{t("student.questionsRail.tipOne")}</li>
          <li>{t("student.questionsRail.tipTwo")}</li>
          <li>{t("student.questionsRail.tipThree")}</li>
        </ul>
      </RailCard>
      <RailCard title={t("student.questionsRail.libraryTitle")}>
        <div class="space-y-2 text-sm">
          <a href="/student/library" class="flex items-center justify-between text-primary">
            <span>{t("student.questionsRail.browseLibrary")}</span>
            <span class="text-xs text-muted-foreground">
              {t("student.questionsRail.badgeNew")}
            </span>
          </a>
          <a href="/student/library" class="flex items-center justify-between text-primary">
            <span>{t("student.questionsRail.saved")}</span>
            <span class="text-xs text-muted-foreground">0</span>
          </a>
        </div>
      </RailCard>
        </CardContent>
      </Card>
    </>
  );
};

const StudentQuestionNewRail = () => {
  const { t } = useI18n();
  return (
    <>
      <RailCard title={t("student.questionNewRail.examplesTitle")}>
        <ul class="space-y-2 text-xs text-muted-foreground">
          <li>{t("student.questionNewRail.exampleOne")}</li>
          <li>{t("student.questionNewRail.exampleTwo")}</li>
        </ul>
      </RailCard>
      <RailCard title={t("student.questionNewRail.libraryTitle")}>
        <div class="space-y-2 text-sm">
          <a href="/student/library" class="flex items-center justify-between text-primary">
            <span>{t("student.questionNewRail.browseLibrary")}</span>
            <span class="text-xs text-muted-foreground">
              {t("student.questionNewRail.badgeRecent")}
            </span>
          </a>
        </div>
      </RailCard>
    </>
  );
};

const StudentQuestionDetailRail = () => {
  const { t } = useI18n();
  return (
    <>
      <RailCard title={t("student.questionDetailRail.relatedTitle")}>
        <div class="space-y-2 text-sm text-muted-foreground">
          <span>{t("student.questionDetailRail.relatedEmpty")}</span>
          <a href="/student/library" class="text-primary underline">
            {t("student.questionDetailRail.browseLibrary")}
          </a>
        </div>
      </RailCard>
    </>
  );
};

const StudentQuestionsRoute = () => (
  <StudentLayout rightRail={<StudentQuestionsRail />}>
    <StudentQuestions />
  </StudentLayout>
);

const StudentQuestionNewRoute = () => (
  <StudentLayout rightRail={<StudentQuestionNewRail />}>
    <StudentQuestionNew />
  </StudentLayout>
);

const StudentQuestionDetailRoute = () => (
  <StudentLayout rightRail={<StudentQuestionDetailRail />}>
    <StudentQuestionDetail />
  </StudentLayout>
);

const StudentLibraryRail = () => {
  const { t } = useI18n();
  return (
    <>
      <Card class="border border-border/70">
        <CardContent class="p-3">
          <Illustration
            src="/illustrations/rail-hero.svg"
            alt={t("student.libraryRail.illustrationAlt")}
            class="h-32 w-full rounded-[var(--radius-lg)]"
          />
        </CardContent>
      </Card>
      <RailCard title={t("student.libraryRail.askTitle")}>
        <div class="space-y-2 text-sm text-muted-foreground">
          <span>{t("student.libraryRail.askBody")}</span>
          <a href="/student/questions/new" class="text-primary underline">
            {t("student.libraryRail.askCta")}
          </a>
        </div>
      </RailCard>
    </>
  );
};

const StudentLibraryRoute = () => (
  <StudentLayout rightRail={<StudentLibraryRail />}>
    <StudentLibrary />
  </StudentLayout>
);

const StudentLibraryDetailRoute = () => (
  <StudentLayout>
    <StudentLibraryDetail />
  </StudentLayout>
);


const AdminLibraryRoute = () => (
  <AdminLayout>
    <AdminLibrary />
  </AdminLayout>
);

const AdminLibraryDetailRoute = () => (
  <AdminLayout>
    <AdminLibraryDetail />
  </AdminLayout>
);

const OnboardingGoalRoute = () => <OnboardingGoal />;
const OnboardingProfileRoute = () => <OnboardingProfile />;
const OnboardingCoursesRoute = () => <OnboardingCourses />;
const OnboardingCheckoutRoute = () => <OnboardingCheckout />;

export default function App() {
  return (
    <>
      <Router>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/blocked" component={Blocked} />
        <Route path="/student" component={StudentHomeRoute} />
        <Route path="/student/home" component={StudentHomeRoute} />
        <Route path="/student/profile" component={StudentProfileRoute} />
        <Route path="/student/questions" component={StudentQuestionsRoute} />
        <Route path="/student/questions/new" component={StudentQuestionNewRoute} />
        <Route path="/student/questions/:id" component={StudentQuestionDetailRoute} />
        <Route path="/student/library" component={StudentLibraryRoute} />
        <Route path="/student/library/:id" component={StudentLibraryDetailRoute} />
        <Route path="/onboarding/goal" component={OnboardingGoalRoute} />
        <Route path="/onboarding/profile" component={OnboardingProfileRoute} />
        <Route path="/onboarding/courses" component={OnboardingCoursesRoute} />
        <Route path="/onboarding/checkout" component={OnboardingCheckoutRoute} />
        <Route path="/admin" component={AdminHomeRoute} />
        <Route path="/admin/home" component={AdminHomeRoute} />
        <Route path="/admin/students" component={AdminStudentsRoute} />
        <Route path="/admin/students/:uid" component={AdminStudentProfileRoute} />
        <Route path="/admin/questions" component={AdminQuestionsRoute} />
        <Route path="/admin/questions/:id" component={AdminQuestionDetailRoute} />
        <Route path="/admin/step-completions" component={AdminStepCompletionsRoute} />
        <Route path="/admin/library" component={AdminLibraryRoute} />
        <Route path="/admin/library/:id" component={AdminLibraryDetailRoute} />
        <Route path="/admin/categories" component={AdminCategoriesRoute} />
        <Route path="/admin/goals" component={AdminGoalsRoute} />
        <Route path="/admin/step-templates" component={AdminStepTemplatesRoute} />
        <Route path="*" component={NotFound} />
      </Router>
      <Toaster />
    </>
  );
}
