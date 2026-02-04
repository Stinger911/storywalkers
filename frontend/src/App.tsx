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
import { Landing } from "./routes/Landing.tsx";
import { Login } from "./routes/Login.tsx";
import { NotFound } from "./routes/NotFound.tsx";
import { StudentLayout } from "./routes/student/StudentLayout.tsx";
import { StudentHome } from "./routes/student/StudentHome.tsx";
import { StudentProfile } from "./routes/student/StudentProfile.tsx";
import { StudentQuestionDetail } from "./routes/student/StudentQuestionDetail.tsx";
import { StudentLibraryDetail } from "./routes/student/StudentLibraryDetail.tsx";
import { AdminLibrary } from "./routes/admin/AdminLibrary.tsx";
import { AdminLibraryDetail } from "./routes/admin/AdminLibraryDetail.tsx";

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

const StudentHomeRoute = () => (
  <StudentLayout>
    <StudentHome />
  </StudentLayout>
);

const StudentProfileRoute = () => (
  <StudentLayout>
    <StudentProfile />
  </StudentLayout>
);

const StudentQuestionDetailRoute = () => (
  <StudentLayout>
    <StudentQuestionDetail />
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

export default function App() {
  return (
    <Router>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/student" component={StudentProfileRoute} />
      <Route path="/student/home" component={StudentHomeRoute} />
      <Route path="/student/profile" component={StudentProfileRoute} />
      <Route path="/student/questions/:id" component={StudentQuestionDetailRoute} />
      <Route path="/student/library/:id" component={StudentLibraryDetailRoute} />
      <Route path="/admin" component={AdminHomeRoute} />
      <Route path="/admin/home" component={AdminHomeRoute} />
      <Route path="/admin/students" component={AdminStudentsRoute} />
      <Route path="/admin/students/:uid" component={AdminStudentProfileRoute} />
      <Route path="/admin/questions" component={AdminQuestionsRoute} />
      <Route path="/admin/questions/:id" component={AdminQuestionDetailRoute} />
      <Route path="/admin/library" component={AdminLibraryRoute} />
      <Route path="/admin/library/:id" component={AdminLibraryDetailRoute} />
      <Route path="/admin/categories" component={AdminCategoriesRoute} />
      <Route path="/admin/goals" component={AdminGoalsRoute} />
      <Route path="/admin/step-templates" component={AdminStepTemplatesRoute} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}
