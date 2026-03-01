const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

// Firestore client SDK (bundled through rules-unit-testing)
const { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc } = require("firebase/firestore");

const PROJECT_ID = "demo-rules-tests"; // any string for emulator
const RULES_PATH = path.resolve(process.cwd(), "..", "..", "firebase", "firestore.rules");

function userRef(db, uid) {
  return doc(db, "users", uid);
}

function planRef(db, uid) {
  return doc(db, "student_plans", uid);
}

function stepRef(db, uid, stepId) {
  return doc(db, "student_plans", uid, "steps", stepId);
}

function questionRef(db, id) {
  return doc(db, "questions", id);
}

function libraryRef(db, id) {
  return doc(db, "library_entries", id);
}

function courseRef(db, id) {
  return doc(db, "courses", id);
}

function lessonRef(db, courseId, lessonId) {
  return doc(db, "courses", courseId, "lessons", lessonId);
}

function paymentRef(db, id) {
  return doc(db, "payments", id);
}

function settingRef(db, id) {
  return doc(db, "settings", id);
}

describe("Firestore security rules (MVP)", () => {
  /** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
  let testEnv;

  // Test identities
  const studentA = { uid: "STUDENT_A", token: { email: "a@test.local" } };
  const studentB = { uid: "STUDENT_B", token: { email: "b@test.local" } };
  const staff = { uid: "STAFF_1", token: { email: "staff@test.local" } };

  beforeAll(async () => {
    const rules = fs.readFileSync(RULES_PATH, "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed baseline data with security disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Users
      await setDoc(userRef(db, studentA.uid), {
        role: "student",
        displayName: "Student A",
        email: "a@test.local",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await setDoc(userRef(db, studentB.uid), {
        role: "student",
        displayName: "Student B",
        email: "b@test.local",
        status: "community_only",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await setDoc(userRef(db, staff.uid), {
        role: "admin",
        displayName: "Staff",
        email: "staff@test.local",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Plans
      await setDoc(planRef(db, studentA.uid), {
        studentUid: studentA.uid,
        goalId: "goal_video_editor",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await setDoc(planRef(db, studentB.uid), {
        studentUid: studentB.uid,
        goalId: "goal_youtube",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Steps
      await setDoc(stepRef(db, studentA.uid, "step1"), {
        templateId: "tmpl_cut_basics",
        title: "Learn basic cuts",
        description: "Watch lesson and practice",
        materialUrl: "https://example.com/1",
        order: 0,
        isDone: false,
        doneAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await setDoc(stepRef(db, studentB.uid, "stepX"), {
        templateId: "tmpl_audio",
        title: "Audio basics",
        description: "Audio lesson",
        materialUrl: "https://example.com/x",
        order: 0,
        isDone: false,
        doneAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Library entries
      await setDoc(libraryRef(db, "kb_published"), {
        categoryId: "cat_audio",
        title: "Remove noise",
        titleLower: "remove noise",
        content: "Steps...",
        videoUrl: null,
        status: "published",
        keywords: ["remove", "noise"],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await setDoc(libraryRef(db, "kb_draft"), {
        categoryId: "cat_audio",
        title: "Draft entry",
        titleLower: "draft entry",
        content: "Draft...",
        videoUrl: null,
        status: "draft",
        keywords: ["draft"],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Courses
      await setDoc(courseRef(db, "course_video"), {
        title: "Video Basics",
        shortDescription: "Editing and export essentials",
        description: "Full description",
        priceUsdCents: 12900,
        goalIds: ["goal_video_editor"],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await setDoc(courseRef(db, "course_inactive"), {
        title: "Inactive Course",
        shortDescription: "Inactive",
        description: "Inactive description",
        priceUsdCents: 9900,
        goalIds: ["goal_video_editor"],
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await setDoc(lessonRef(db, "course_video", "lesson_1"), {
        title: "Lesson 1",
        content: "Lesson content",
        order: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Payments + settings
      await setDoc(paymentRef(db, "pay_1"), {
        userUid: studentA.uid,
        email: "a@test.local",
        provider: "boosty",
        selectedCourses: ["course_video"],
        amount: 12900,
        currency: "USD",
        activationCode: "SW-ABCD1234",
        status: "created",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(settingRef(db, "gmail"), {
        enabled: true,
        watchTopic: "projects/p/topics/gmail",
        lastHistoryId: "100",
        watchExpiration: new Date(),
      });

      // A question owned by studentA
      await setDoc(questionRef(db, "q1"), {
        studentUid: studentA.uid,
        categoryId: "cat_editing",
        title: "How to cut?",
        body: "Question body",
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
        answer: null,
      });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test("Student can read own user doc but cannot change role/status/email/createdAt", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();

    await assertSucceeds(getDoc(userRef(dbA, studentA.uid)));
    await assertFails(getDoc(userRef(dbA, studentB.uid)));

    // Allowed: update displayName (+ updatedAt)
    await assertSucceeds(updateDoc(userRef(dbA, studentA.uid), { displayName: "A2", updatedAt: new Date() }));

    // Forbidden: change role
    await assertFails(updateDoc(userRef(dbA, studentA.uid), { role: "admin" }));
    // Forbidden: change status
    await assertFails(updateDoc(userRef(dbA, studentA.uid), { status: "disabled" }));
    // Forbidden: change email
    await assertFails(updateDoc(userRef(dbA, studentA.uid), { email: "evil@test.local" }));
    // Forbidden: change createdAt
    await assertFails(updateDoc(userRef(dbA, studentA.uid), { createdAt: new Date() }));
  });

  test("Student can read own plan and steps; cannot read other student's plan/steps", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();

    await assertSucceeds(getDoc(planRef(dbA, studentA.uid)));
    await assertFails(getDoc(planRef(dbA, studentB.uid)));

    await assertSucceeds(getDoc(stepRef(dbA, studentA.uid, "step1")));
    await assertFails(getDoc(stepRef(dbA, studentB.uid, "stepX")));
  });

  test("Student cannot write plan doc (staff-only)", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();

    await assertFails(updateDoc(planRef(dbA, studentA.uid), { goalId: "goal_hacked", updatedAt: new Date() }));
  });

  test("Student can toggle step progress only (isDone/doneAt/updatedAt)", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();

    // Mark done: isDone true requires doneAt timestamp
    await assertSucceeds(updateDoc(stepRef(dbA, studentA.uid, "step1"), {
      isDone: true,
      doneAt: new Date(),
      updatedAt: new Date(),
    }));

    // Mark undone: isDone false requires doneAt null
    await assertSucceeds(updateDoc(stepRef(dbA, studentA.uid, "step1"), {
      isDone: false,
      doneAt: null,
      updatedAt: new Date(),
    }));

    // Forbidden: change title
    await assertFails(updateDoc(stepRef(dbA, studentA.uid, "step1"), { title: "Hacked" }));
    // Forbidden: change order
    await assertFails(updateDoc(stepRef(dbA, studentA.uid, "step1"), { order: 999 }));
    // Forbidden: change materialUrl
    await assertFails(updateDoc(stepRef(dbA, studentA.uid, "step1"), { materialUrl: "https://evil" }));
    // Forbidden: set isDone true with doneAt null
    await assertFails(updateDoc(stepRef(dbA, studentA.uid, "step1"), { isDone: true, doneAt: null }));
    // Forbidden: set isDone false with doneAt timestamp
    await assertFails(updateDoc(stepRef(dbA, studentA.uid, "step1"), { isDone: false, doneAt: new Date() }));
  });

  test("Student cannot create or delete steps (staff-only)", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();

    await assertFails(setDoc(stepRef(dbA, studentA.uid, "step2"), {
      templateId: null,
      title: "New",
      description: "New",
      materialUrl: "https://example.com/new",
      order: 1,
      isDone: false,
      doneAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await assertFails(deleteDoc(stepRef(dbA, studentA.uid, "step1")));
  });

  test("Student can create question with status=new and answer=null; cannot write answer or status=answered", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();

    // Create OK
    await assertSucceeds(setDoc(questionRef(dbA, "q_new"), {
      studentUid: studentA.uid,
      categoryId: "cat_editing",
      title: "New question",
      body: "Body",
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
      answer: null,
    }));

    // Create FAIL: wrong studentUid
    await assertFails(setDoc(questionRef(dbA, "q_bad_owner"), {
      studentUid: studentB.uid,
      categoryId: "cat_editing",
      title: "Bad",
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
      answer: null,
    }));

    // Create FAIL: student sets answered status
    await assertFails(setDoc(questionRef(dbA, "q_bad_status"), {
      studentUid: studentA.uid,
      categoryId: "cat_editing",
      title: "Bad status",
      status: "answered",
      createdAt: new Date(),
      updatedAt: new Date(),
      answer: null,
    }));

    // Create FAIL: student writes answer
    await assertFails(setDoc(questionRef(dbA, "q_bad_answer"), {
      studentUid: studentA.uid,
      categoryId: "cat_editing",
      title: "Bad answer",
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
      answer: { text: "Nope" },
    }));
  });

  test("Student can edit own question only while status=new, cannot edit once answered", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();

    // Edit allowed fields before answered
    await assertSucceeds(updateDoc(questionRef(dbA, "q1"), {
      title: "Updated title",
      updatedAt: new Date(),
    }));

    // Forbidden: student tries to set status/answer
    await assertFails(updateDoc(questionRef(dbA, "q1"), { status: "answered" }));
    await assertFails(updateDoc(questionRef(dbA, "q1"), { answer: { text: "hack" } }));

    // Staff answers question
    const dbStaff = testEnv.authenticatedContext(staff.uid, staff.token).firestore();
    await assertSucceeds(updateDoc(questionRef(dbStaff, "q1"), {
      status: "answered",
      updatedAt: new Date(),
      answer: {
        expertUid: staff.uid,
        text: "Answer text",
        videoUrl: null,
        createdAt: new Date(),
        publishToLibrary: true,
      },
    }));

    // Now student cannot edit title/body/categoryId
    await assertFails(updateDoc(questionRef(dbA, "q1"), {
      title: "Try edit after answered",
      updatedAt: new Date(),
    }));
  });

  test("Student can read only own questions; staff can read all", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();
    const dbB = testEnv.authenticatedContext(studentB.uid, studentB.token).firestore();
    const dbStaff = testEnv.authenticatedContext(staff.uid, staff.token).firestore();

    await assertSucceeds(getDoc(questionRef(dbA, "q1")));
    await assertFails(getDoc(questionRef(dbB, "q1")));
    await assertSucceeds(getDoc(questionRef(dbStaff, "q1")));
  });

  test("Library: student reads only published; staff reads draft too; student cannot write", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();
    const dbStaff = testEnv.authenticatedContext(staff.uid, staff.token).firestore();

    await assertSucceeds(getDoc(libraryRef(dbA, "kb_published")));
    await assertFails(getDoc(libraryRef(dbA, "kb_draft")));

    await assertSucceeds(getDoc(libraryRef(dbStaff, "kb_draft")));

    // Student cannot create/update/delete library entries
    await assertFails(setDoc(libraryRef(dbA, "kb_new"), {
      categoryId: "cat_audio",
      title: "Hacked",
      content: "No",
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await assertFails(updateDoc(libraryRef(dbA, "kb_published"), { title: "Hacked" }));
    await assertFails(deleteDoc(libraryRef(dbA, "kb_published")));
  });

  test("Courses: students read only active; lessons are staff-only", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();
    const dbB = testEnv.authenticatedContext(studentB.uid, studentB.token).firestore();
    const dbStaff = testEnv.authenticatedContext(staff.uid, staff.token).firestore();

    // students can read active courses
    await assertSucceeds(getDoc(courseRef(dbA, "course_video")));
    await assertSucceeds(getDoc(courseRef(dbB, "course_video")));
    // students cannot read inactive courses
    await assertFails(getDoc(courseRef(dbA, "course_inactive")));
    await assertFails(getDoc(courseRef(dbB, "course_inactive")));

    // staff can read any course
    await assertSucceeds(getDoc(courseRef(dbStaff, "course_inactive")));

    // students cannot read lessons directly
    await assertFails(getDoc(lessonRef(dbA, "course_video", "lesson_1")));
    await assertFails(getDoc(lessonRef(dbB, "course_video", "lesson_1")));

    // students cannot write lessons directly
    await assertFails(updateDoc(lessonRef(dbA, "course_video", "lesson_1"), { title: "Hack" }));

    // staff has full lesson access
    await assertSucceeds(getDoc(lessonRef(dbStaff, "course_video", "lesson_1")));
    await assertSucceeds(updateDoc(lessonRef(dbStaff, "course_video", "lesson_1"), { title: "Staff Edit" }));
  });

  test("Courses/Lessons: staff can CRUD", async () => {
    const dbStaff = testEnv.authenticatedContext(staff.uid, staff.token).firestore();

    await assertSucceeds(setDoc(courseRef(dbStaff, "course_staff_new"), {
      title: "Staff Course",
      description: "Created by staff",
      priceUsdCents: 19900,
      goalIds: ["goal_video_editor"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await assertSucceeds(setDoc(lessonRef(dbStaff, "course_staff_new", "lesson_new"), {
      title: "Lesson New",
      type: "text",
      content: "Body",
      order: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await assertSucceeds(updateDoc(courseRef(dbStaff, "course_staff_new"), {
      title: "Staff Course Updated",
      updatedAt: new Date(),
    }));
    await assertSucceeds(updateDoc(lessonRef(dbStaff, "course_staff_new", "lesson_new"), {
      order: 2,
      updatedAt: new Date(),
    }));

    await assertSucceeds(getDoc(courseRef(dbStaff, "course_staff_new")));
    await assertSucceeds(getDoc(lessonRef(dbStaff, "course_staff_new", "lesson_new")));

    await assertSucceeds(deleteDoc(lessonRef(dbStaff, "course_staff_new", "lesson_new")));
    await assertSucceeds(deleteDoc(courseRef(dbStaff, "course_staff_new")));
  });

  test("Payments: student cannot read payments and cannot activate/write", async () => {
    const dbA = testEnv.authenticatedContext(studentA.uid, studentA.token).firestore();

    await assertFails(getDoc(paymentRef(dbA, "pay_1")));
    await assertFails(updateDoc(paymentRef(dbA, "pay_1"), { status: "activated" }));
    await assertFails(updateDoc(settingRef(dbA, "gmail"), { lastHistoryId: "101" }));
  });

  test("Payments: staff can read payment docs", async () => {
    const dbStaff = testEnv.authenticatedContext(staff.uid, staff.token).firestore();
    await assertSucceeds(getDoc(paymentRef(dbStaff, "pay_1")));
  });

  test("Staff can create/reorder steps and manage plans (sanity)", async () => {
    const dbStaff = testEnv.authenticatedContext(staff.uid, staff.token).firestore();

    // Staff can update plan
    await assertSucceeds(updateDoc(planRef(dbStaff, studentA.uid), { goalId: "goal_new", updatedAt: new Date() }));

    // Staff can create step
    await assertSucceeds(setDoc(stepRef(dbStaff, studentA.uid, "step2"), {
      templateId: null,
      title: "Staff created",
      description: "Desc",
      materialUrl: "https://example.com/2",
      order: 1,
      isDone: false,
      doneAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Staff can reorder (update order)
    await assertSucceeds(updateDoc(stepRef(dbStaff, studentA.uid, "step2"), { order: 0, updatedAt: new Date() }));
  });
});
