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
import { StudentProfile, StudentProfileRail } from "./routes/student/StudentProfile.tsx";
import { StudentQuestionDetail } from "./routes/student/StudentQuestionDetail.tsx";
import { StudentQuestionNew } from "./routes/student/StudentQuestionNew.tsx";
import { StudentQuestions } from "./routes/student/StudentQuestions.tsx";
import { RailCard } from "./components/ui/rail-card.tsx";
import { Card, CardContent } from "./components/ui/card.tsx";
import { Illustration } from "./components/ui/illustration.tsx";
import { StudentLibrary } from "./routes/student/StudentLibrary.tsx";
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

const StudentProfileRoute = () => (
  <StudentLayout rightRail={<StudentProfileRail />}>
    <StudentProfile />
  </StudentLayout>
);

const StudentQuestionsRail = () => (
  <>
    <Card class="border border-border/70">
      <CardContent class="p-3">
        <Illustration
          src="/illustrations/rail-hero.svg"
          alt="Questions illustration"
          class="h-32 w-full rounded-[var(--radius-lg)]"
        />
      </CardContent>
    </Card>
    <RailCard title="Tips">
      <ul class="space-y-2 text-xs text-muted-foreground">
        <li>Share what you tried already.</li>
        <li>Attach references or examples.</li>
        <li>Keep one question per post.</li>
      </ul>
    </RailCard>
    <RailCard title="Library">
      <div class="space-y-2 text-sm">
        <a href="/student/library" class="flex items-center justify-between text-primary">
          <span>Browse Library</span>
          <span class="text-xs text-muted-foreground">New</span>
        </a>
        <a href="/student/library" class="flex items-center justify-between text-primary">
          <span>Saved</span>
          <span class="text-xs text-muted-foreground">0</span>
        </a>
      </div>
    </RailCard>
  </>
);

const StudentQuestionNewRail = () => (
  <>
    <RailCard title="Examples">
      <ul class="space-y-2 text-xs text-muted-foreground">
        <li>“How do I trim silence in Premiere?”</li>
        <li>“Best export settings for Instagram reels?”</li>
      </ul>
    </RailCard>
    <RailCard title="Library">
      <div class="space-y-2 text-sm">
        <a href="/student/library" class="flex items-center justify-between text-primary">
          <span>Browse Library</span>
          <span class="text-xs text-muted-foreground">Recent</span>
        </a>
      </div>
    </RailCard>
  </>
);

const StudentQuestionDetailRail = () => (
  <>
    <RailCard title="Related library">
      <div class="space-y-2 text-sm text-muted-foreground">
        <span>Recommended entries will appear here.</span>
        <a href="/student/library" class="text-primary underline">
          Browse library
        </a>
      </div>
    </RailCard>
  </>
);

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

const StudentLibraryRail = () => (
  <>
    <Card class="border border-border/70">
      <CardContent class="p-3">
        <Illustration
          src="/illustrations/rail-hero.svg"
          alt="Library illustration"
          class="h-32 w-full rounded-[var(--radius-lg)]"
        />
      </CardContent>
    </Card>
    <RailCard title="Ask a question">
      <div class="space-y-2 text-sm text-muted-foreground">
        <span>Can’t find what you need?</span>
        <a href="/student/questions/new" class="text-primary underline">
          Ask a mentor
        </a>
      </div>
    </RailCard>
  </>
);

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

export default function App() {
  return (
    <Router>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/student" component={StudentProfileRoute} />
      <Route path="/student/home" component={StudentProfileRoute} />
      <Route path="/student/profile" component={StudentProfileRoute} />
      <Route path="/student/questions" component={StudentQuestionsRoute} />
      <Route path="/student/questions/new" component={StudentQuestionNewRoute} />
      <Route path="/student/questions/:id" component={StudentQuestionDetailRoute} />
      <Route path="/student/library" component={StudentLibraryRoute} />
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
