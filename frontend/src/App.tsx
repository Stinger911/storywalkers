import { Route, Router } from "@solidjs/router";
import { Suspense, lazy } from "solid-js";
import "./App.css";
import { AdminLayout } from "./routes/admin/AdminLayout.tsx";
import { StudentLayout } from "./routes/student/StudentLayout.tsx";
import { Toaster } from "./components/ui/toast.tsx";
import { Loading } from "./components/Loading.tsx";

const Landing = lazy(async () => {
  const module = await import("./routes/Landing.tsx");
  return { default: module.Landing };
});

const Login = lazy(async () => {
  const module = await import("./routes/Login.tsx");
  return { default: module.Login };
});

const Blocked = lazy(async () => {
  const module = await import("./routes/Blocked.tsx");
  return { default: module.Blocked };
});

const NotFound = lazy(async () => {
  const module = await import("./routes/NotFound.tsx");
  return { default: module.NotFound };
});

const AdminHome = lazy(async () => {
  const module = await import("./routes/admin/AdminHome.tsx");
  return { default: module.AdminHome };
});

const AdminStudents = lazy(async () => {
  const module = await import("./routes/admin/AdminStudents.tsx");
  return { default: module.AdminStudents };
});

const AdminStudentProfile = lazy(async () => {
  const module = await import("./routes/admin/AdminStudentProfile.tsx");
  return { default: module.AdminStudentProfile };
});

const AdminStudentDashboardPreview = lazy(async () => {
  const module = await import("./routes/admin/AdminStudentDashboardPreview.tsx");
  return { default: module.AdminStudentDashboardPreview };
});

const AdminCategories = lazy(async () => {
  const module = await import("./routes/admin/AdminCategories.tsx");
  return { default: module.AdminCategories };
});

const AdminGoals = lazy(async () => {
  const module = await import("./routes/admin/AdminGoals.tsx");
  return { default: module.AdminGoals };
});

const AdminQuestions = lazy(async () => {
  const module = await import("./routes/admin/AdminQuestions.tsx");
  return { default: module.AdminQuestions };
});

const AdminQuestionDetail = lazy(async () => {
  const module = await import("./routes/admin/AdminQuestionDetail.tsx");
  return { default: module.AdminQuestionDetail };
});

const AdminStepCompletions = lazy(async () => {
  const module = await import("./routes/admin/AdminStepCompletions.tsx");
  return { default: module.AdminStepCompletions };
});

const AdminCourses = lazy(async () => {
  const module = await import("./routes/admin/AdminCourses.tsx");
  return { default: module.AdminCourses };
});

const AdminCourseLessons = lazy(async () => {
  const module = await import("./routes/admin/AdminCourseLessons.tsx");
  return { default: module.AdminCourseLessons };
});

const AdminPayments = lazy(async () => {
  const module = await import("./routes/admin/AdminPayments.tsx");
  return { default: module.AdminPayments };
});

const AdminPaymentDetail = lazy(async () => {
  const module = await import("./routes/admin/AdminPaymentDetail.tsx");
  return { default: module.AdminPaymentDetail };
});

const AdminLibrary = lazy(async () => {
  const module = await import("./routes/admin/AdminLibrary.tsx");
  return { default: module.AdminLibrary };
});

const AdminLibraryDetail = lazy(async () => {
  const module = await import("./routes/admin/AdminLibraryDetail.tsx");
  return { default: module.AdminLibraryDetail };
});

const StudentProfile = lazy(async () => {
  const module = await import("./routes/student/StudentProfile.tsx");
  return { default: module.StudentProfile };
});

const StudentHomeRoute = lazy(async () => {
  const module = await import("./routes/student/StudentHomeRoute.tsx");
  return { default: module.StudentHomeRoute };
});

const StudentQuestions = lazy(async () => {
  const module = await import("./routes/student/StudentQuestions.tsx");
  return { default: module.StudentQuestions };
});

const StudentQuestionNew = lazy(async () => {
  const module = await import("./routes/student/StudentQuestionNew.tsx");
  return { default: module.StudentQuestionNew };
});

const StudentQuestionDetail = lazy(async () => {
  const module = await import("./routes/student/StudentQuestionDetail.tsx");
  return { default: module.StudentQuestionDetail };
});

const StudentLibrary = lazy(async () => {
  const module = await import("./routes/student/StudentLibrary.tsx");
  return { default: module.StudentLibrary };
});

const StudentLibraryDetail = lazy(async () => {
  const module = await import("./routes/student/StudentLibraryDetail.tsx");
  return { default: module.StudentLibraryDetail };
});

const StudentCourses = lazy(async () => {
  const module = await import("./routes/student/StudentCourses.tsx");
  return { default: module.StudentCourses };
});

const OnboardingGoal = lazy(async () => {
  const module = await import("./routes/onboarding/OnboardingGoal.tsx");
  return { default: module.OnboardingGoal };
});

const OnboardingProfile = lazy(async () => {
  const module = await import("./routes/onboarding/OnboardingProfile.tsx");
  return { default: module.OnboardingProfile };
});

const OnboardingCourses = lazy(async () => {
  const module = await import("./routes/onboarding/OnboardingCourses.tsx");
  return { default: module.OnboardingCourses };
});

const OnboardingCheckout = lazy(async () => {
  const module = await import("./routes/onboarding/OnboardingCheckout.tsx");
  return { default: module.OnboardingCheckout };
});

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

const AdminStudentDashboardPreviewRoute = () => (
  <AdminLayout>
    <AdminStudentDashboardPreview />
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

const AdminCoursesRoute = () => (
  <AdminLayout>
    <AdminCourses />
  </AdminLayout>
);

const AdminCourseLessonsRoute = () => (
  <AdminLayout>
    <AdminCourseLessons />
  </AdminLayout>
);

const AdminPaymentsRoute = () => (
  <AdminLayout>
    <AdminPayments />
  </AdminLayout>
);

const AdminPaymentDetailRoute = () => (
  <AdminLayout>
    <AdminPaymentDetail />
  </AdminLayout>
);

const StudentProfileRoute = () => (
  <StudentLayout>
    <StudentProfile />
  </StudentLayout>
);

const StudentQuestionsRoute = () => (
  <StudentLayout>
    <StudentQuestions />
  </StudentLayout>
);

const StudentQuestionNewRoute = () => (
  <StudentLayout>
    <StudentQuestionNew />
  </StudentLayout>
);

const StudentQuestionDetailRoute = () => (
  <StudentLayout>
    <StudentQuestionDetail />
  </StudentLayout>
);

const StudentLibraryRoute = () => (
  <StudentLayout>
    <StudentLibrary />
  </StudentLayout>
);

const StudentLibraryDetailRoute = () => (
  <StudentLayout>
    <StudentLibraryDetail />
  </StudentLayout>
);

const StudentCoursesRoute = () => (
  <StudentLayout>
    <StudentCourses />
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
      <Suspense fallback={<div class="page"><Loading /></div>}>
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
          <Route path="/student/courses" component={StudentCoursesRoute} />
          <Route path="/onboarding/goal" component={OnboardingGoalRoute} />
          <Route path="/onboarding/profile" component={OnboardingProfileRoute} />
          <Route path="/onboarding/courses" component={OnboardingCoursesRoute} />
          <Route path="/onboarding/checkout" component={OnboardingCheckoutRoute} />
          <Route path="/admin" component={AdminHomeRoute} />
          <Route path="/admin/home" component={AdminHomeRoute} />
          <Route path="/admin/students" component={AdminStudentsRoute} />
          <Route path="/admin/students/:uid" component={AdminStudentProfileRoute} />
          <Route path="/admin/students/:uid/view-as" component={AdminStudentDashboardPreviewRoute} />
          <Route path="/admin/questions" component={AdminQuestionsRoute} />
          <Route path="/admin/questions/:id" component={AdminQuestionDetailRoute} />
          <Route path="/admin/step-completions" component={AdminStepCompletionsRoute} />
          <Route path="/admin/courses" component={AdminCoursesRoute} />
          <Route path="/admin/courses/:courseId/lessons" component={AdminCourseLessonsRoute} />
          <Route path="/admin/payments" component={AdminPaymentsRoute} />
          <Route path="/admin/payments/:id" component={AdminPaymentDetailRoute} />
          <Route path="/admin/library" component={AdminLibraryRoute} />
          <Route path="/admin/library/:id" component={AdminLibraryDetailRoute} />
          <Route path="/admin/categories" component={AdminCategoriesRoute} />
          <Route path="/admin/goals" component={AdminGoalsRoute} />
          <Route path="*" component={NotFound} />
        </Router>
      </Suspense>
      <Toaster />
    </>
  );
}
