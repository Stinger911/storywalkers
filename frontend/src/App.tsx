import { Route, Router } from "@solidjs/router";
import "./App.css";
import { AdminLayout } from "./routes/admin/AdminLayout.tsx";
import { AdminCategories } from "./routes/admin/AdminCategories.tsx";
import { AdminHome } from "./routes/admin/AdminHome.tsx";
import { AdminGoals } from "./routes/admin/AdminGoals.tsx";
import { AdminStepTemplates } from "./routes/admin/AdminStepTemplates.tsx";
import { AdminStudentProfile } from "./routes/admin/AdminStudentProfile.tsx";
import { AdminStudents } from "./routes/admin/AdminStudents.tsx";
import { Landing } from "./routes/Landing.tsx";
import { Login } from "./routes/Login.tsx";
import { NotFound } from "./routes/NotFound.tsx";
import { StudentLayout } from "./routes/student/StudentLayout.tsx";
import { StudentHome } from "./routes/student/StudentHome.tsx";

export default function App() {
  return (
    <Router>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/student/*" component={StudentLayout}>
        <Route path="/" component={StudentHome} />
        <Route path="/home" component={StudentHome} />
      </Route>
      <Route path="/admin/*" component={AdminLayout}>
        <Route path="/" component={AdminHome} />
        <Route path="/home" component={AdminHome} />
        <Route path="/students" component={AdminStudents} />
        <Route path="/students/:uid" component={AdminStudentProfile} />
        <Route path="/categories" component={AdminCategories} />
        <Route path="/goals" component={AdminGoals} />
        <Route path="/step-templates" component={AdminStepTemplates} />
      </Route>
      <Route path="*" component={NotFound} />
    </Router>
  );
}
