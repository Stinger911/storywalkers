import {
  createContext,
  createMemo,
  createSignal,
  useContext,
  type JSX,
} from "solid-js";
import * as i18n from "@solid-primitives/i18n";

type RawDictionary = {
  common: {
    loading: string;
    refresh: string;
    apply: string;
    clear: string;
    open: string;
    view: string;
    category: string;
    search: string;
    allCategories: string;
    filters: string;
    entries: string;
    questions: string;
    question: string;
    answer: string;
    language: string;
    status: {
      new: string;
      answered: string;
      draft: string;
      published: string;
    };
  };
  login: {
    title: string;
    subtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    signInPassword: string;
    createAccount: string;
    sendLink: string;
    or: string;
    continueGoogle: string;
    messages: {
      signedIn: string;
      accountCreated: string;
      googleSuccess: string;
      emailLinkHint: string;
      emailLinkSent: string;
      emailLinkSentSetPassword: string;
      linkSignedIn: string;
      linkSignedInPasswordEnabled: string;
    };
    errors: {
      unauthorizedDomain: string;
      accountExists: string;
      popupClosed: string;
      invalidEmail: string;
      wrongPassword: string;
      tooManyRequests: string;
      missingEmail: string;
      emailAlreadyInUse: string;
      weakPassword: string;
      missingEmailForLink: string;
      profileMissing: string;
      roleMissing: string;
      generic: string;
      genericWithMessage: string;
    };
  };
  student: {
    layout: {
      title: string;
      roleLabel: string;
      tabs: {
        profile: string;
        questions: string;
        library: string;
      };
      reportBug: string;
      logout: string;
    };
    home: {
      greeting: string;
      fallbackName: string;
      signedInAs: string;
      noGoalTitle: string;
      noGoalBody: string;
      contactAdmin: string;
      dashboardTitle: string;
      progressComplete: string;
      goalLabel: string;
      goalFallbackTitle: string;
      goalFallbackDescription: string;
      goalThumbnailAlt: string;
      stepsTitle: string;
      stepsDescription: string;
      stepsEmpty: string;
      stepsAskQuestion: string;
      stepsBrowseLibrary: string;
      markDone: string;
      markNotDone: string;
      currentStepTitle: string;
      currentStepDescription: string;
      currentStepLabel: string;
      currentStepMaterial: string;
      currentStepMarkDone: string;
      currentStepEmpty: string;
      completeDialogTitle: string;
      completeDialogDescription: string;
      completeDialogCommentLabel: string;
      completeDialogLinkLabel: string;
      completeDialogLinkPlaceholder: string;
      completeDialogDriveHelpTitle: string;
      completeDialogDriveHelpStep1: string;
      completeDialogDriveHelpStep2: string;
      completeDialogDriveHelpStep3: string;
      completeDialogDriveHelpStep4: string;
      completeDialogCancel: string;
      completeDialogConfirm: string;
      completeDialogErrorTitle: string;
      completeDialogErrorBody: string;
    };
    questionsRail: {
      illustrationAlt: string;
      tipsTitle: string;
      tipOne: string;
      tipTwo: string;
      tipThree: string;
      libraryTitle: string;
      browseLibrary: string;
      badgeNew: string;
      saved: string;
    };
    library: {
      title: string;
      filtersDescription: string;
      searchPlaceholder: string;
      categoryPlaceholder: string;
      entriesTitle: string;
      entryThumbnailAlt: string;
      updated: string;
      empty: string;
    };
    libraryRail: {
      illustrationAlt: string;
      askTitle: string;
      askBody: string;
      askCta: string;
    };
    libraryDetail: {
      title: string;
      back: string;
      fallbackTitle: string;
      watchVideo: string;
      noIdError: string;
    };
    questions: {
      title: string;
      askQuestion: string;
      filtersDescription: string;
      searchPlaceholder: string;
      statusAll: string;
      statusNew: string;
      statusAnswered: string;
      questionsTitle: string;
      generalCategory: string;
    };
    questionNew: {
      title: string;
      subtitle: string;
      cardTitle: string;
      selectCategory: string;
      titleLabel: string;
      detailsLabel: string;
      titlePlaceholder: string;
      detailsPlaceholder: string;
      submit: string;
      cancel: string;
      requiredError: string;
    };
    questionNewRail: {
      examplesTitle: string;
      exampleOne: string;
      exampleTwo: string;
      libraryTitle: string;
      browseLibrary: string;
      badgeRecent: string;
    };
    questionDetail: {
      title: string;
      back: string;
      fallbackTitle: string;
      noDetails: string;
      pending: string;
      watchVideo: string;
      noIdError: string;
    };
    questionDetailRail: {
      relatedTitle: string;
      relatedEmpty: string;
      browseLibrary: string;
    };
    profileRail: {
      myQuestions: string;
      newLabel: string;
      askQuestion: string;
      library: string;
      recent: string;
      saved: string;
      learningIllustrationAlt: string;
      questionsAlt: string;
      libraryAlt: string;
    };
    onboarding: {
      stepperTitle: string;
      steps: {
        goal: string;
        profile: string;
        courses: string;
        checkout: string;
      };
      common: {
        saving: string;
        saveAndContinue: string;
      };
      goal: {
        title: string;
        subtitle: string;
        cardTitle: string;
        cardDescription: string;
        noDescription: string;
        selectedBadge: string;
        next: string;
        retry: string;
        empty: string;
        loadError: string;
        saveError: string;
      };
      profile: {
        title: string;
        subtitle: string;
        cardTitle: string;
        telegramLabel: string;
        telegramPlaceholder: string;
        socialUrlLabel: string;
        socialUrlPlaceholder: string;
        experienceLevelLabel: string;
        experienceLevelPlaceholder: string;
        experienceBeginner: string;
        experienceIntermediate: string;
        experienceAdvanced: string;
        notesLabel: string;
        notesPlaceholder: string;
        disclaimer: string;
        back: string;
        submit: string;
        next: string;
      };
      courses: {
        title: string;
        subtitle: string;
        cardTitle: string;
        cardDescription: string;
        currencyLabel: string;
        selected: string;
        clickToSelect: string;
        totalLabel: string;
        communityTitle: string;
        communityDescription: string;
        inactiveSectionTitle: string;
        inactiveBadge: string;
        retry: string;
        loadError: string;
        saveError: string;
        currencySaveError: string;
        empty: string;
      };
      checkout: {
        title: string;
        subtitle: string;
        cardTitle: string;
        goalLabel: string;
        goalEmpty: string;
        coursesLabel: string;
        coursesEmpty: string;
        communityLabel: string;
        totalLabel: string;
        boostyCta: string;
        afterPaymentTitle: string;
        afterPaymentManual: string;
        afterPaymentContactLabel: string;
      };
    };
  };
};

type Locale = "en" | "ru";

const dictionaries: Record<Locale, RawDictionary> = {
  en: {
    common: {
      loading: "Loading…",
      refresh: "Refresh",
      apply: "Apply",
      clear: "Clear",
      open: "Open",
      view: "View",
      category: "Category",
      search: "Search",
      allCategories: "All categories",
      filters: "Filters",
      entries: "Entries",
      questions: "Questions",
      question: "Question",
      answer: "Answer",
      language: "Language",
      status: {
        new: "New",
        answered: "Answered",
        draft: "Draft",
        published: "Published",
      },
    },
    login: {
      title: "Sign in",
      subtitle: "Email/Password, Email link, or Google",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      signInPassword: "Sign in with password",
      createAccount: "Create account (email/password)",
      sendLink: "Send sign-in link (passwordless)",
      or: "or",
      continueGoogle: "Continue with Google",
      messages: {
        signedIn: "Signed in successfully.",
        accountCreated: "Account created and signed in.",
        googleSuccess: "Signed in with Google.",
        emailLinkHint:
          "We will send a sign-in link. If you used password or Google before, that is okay.",
        emailLinkSent:
          "Sign-in link sent. Open the email and follow the link to continue.",
        emailLinkSentSetPassword:
          "This email already exists. We sent a sign-in link. Open it to sign in and enable password login.",
        linkSignedIn: "Signed in with the email link.",
        linkSignedInPasswordEnabled:
          "Signed in with email link. Password login is now enabled for this email.",
      },
      errors: {
        unauthorizedDomain:
          "Google login is not available for this domain. Add the current domain (e.g., localhost) in Firebase Console → Authentication → Settings → Authorized domains.",
        accountExists:
          "An account with this email already exists with a different sign-in method. Use that method first, then link Google in profile settings.",
        popupClosed: "The sign-in window was closed. Please try again.",
        invalidEmail: "Invalid email.",
        wrongPassword: "Incorrect email or password.",
        tooManyRequests: "Too many attempts. Please wait and try again.",
        missingEmail: "Enter your email.",
        emailAlreadyInUse: "An account with this email already exists.",
        weakPassword: "Password is too weak (minimum 6 characters).",
        missingEmailForLink:
          "Enter the email that received the link (no saved email found in this browser).",
        profileMissing: "Could not load user profile after sign-in.",
        roleMissing: "Invalid user role.",
        generic: "Sign-in failed. Please try again.",
        genericWithMessage: "Sign-in error: {{ message }}",
      },
    },
    student: {
      layout: {
        title: "Student Dashboard",
        roleLabel: "Student",
        tabs: {
          profile: "Profile",
          questions: "My Questions",
          library: "Library",
        },
        reportBug: "Report a bug",
        logout: "Logout",
      },
      home: {
        greeting: "Hi, {{ name }}!",
        fallbackName: "there",
        signedInAs: "Signed in as",
        noGoalTitle: "No goal assigned",
        noGoalBody: "We’ll notify you once a learning goal is assigned.",
        contactAdmin: "Contact admin",
        dashboardTitle: "Student Dashboard",
        progressComplete: "{{ percent }}% complete",
        goalLabel: "Goal",
        goalFallbackTitle: "Learning goal",
        goalFallbackDescription: "Your personalized learning path.",
        goalThumbnailAlt: "Goal thumbnail",
        stepsTitle: "Steps",
        stepsDescription: "Work through your path in order.",
        stepsEmpty: "No steps yet. Ask a question or explore the library.",
        stepsAskQuestion: "Ask a question",
        stepsBrowseLibrary: "Browse library",
        markDone: "Mark as done",
        markNotDone: "Mark as not done",
        currentStepTitle: "Current step",
        currentStepDescription: "Focus on the next unfinished step in your path.",
        currentStepLabel: "Up next",
        currentStepMaterial: "View material",
        currentStepMarkDone: "Mark done",
        currentStepEmpty: "You’ve completed every step. Nice work!",
        completeDialogTitle: "Complete step",
        completeDialogDescription: "Add a comment and link if needed.",
        completeDialogCommentLabel: "Comment (optional)",
        completeDialogLinkLabel: "Link (optional)",
        completeDialogLinkPlaceholder: "https://...",
        completeDialogDriveHelpTitle: "How to add a Google Drive link?",
        completeDialogDriveHelpStep1: "Upload your file to Google Drive.",
        completeDialogDriveHelpStep2: "Open link sharing.",
        completeDialogDriveHelpStep3: "Set access to “Viewer”.",
        completeDialogDriveHelpStep4: "Copy the link and paste it above.",
        completeDialogCancel: "Cancel",
        completeDialogConfirm: "Complete step",
        completeDialogErrorTitle: "Error",
        completeDialogErrorBody: "Could not complete step",
      },
      questionsRail: {
        illustrationAlt: "Questions illustration",
        tipsTitle: "Tips",
        tipOne: "Share what you tried already.",
        tipTwo: "Attach references or examples.",
        tipThree: "Keep one question per post.",
        libraryTitle: "Library",
        browseLibrary: "Browse Library",
        badgeNew: "New",
        saved: "Saved",
      },
      library: {
        title: "Library",
        filtersDescription: "Search by topic or category.",
        searchPlaceholder: "Noise reduction, lighting, etc.",
        categoryPlaceholder: "All categories",
        entriesTitle: "Entries",
        entryThumbnailAlt: "Entry thumbnail",
        updated: "Updated {{ date }}",
        empty: "No entries match the current filters.",
      },
      libraryRail: {
        illustrationAlt: "Library illustration",
        askTitle: "Ask a question",
        askBody: "Can’t find what you need?",
        askCta: "Ask a mentor",
      },
      libraryDetail: {
        title: "Library entry",
        back: "Back to library",
        fallbackTitle: "Library entry",
        watchVideo: "Watch video",
        noIdError: "No library entry ID provided.",
      },
      questions: {
        title: "My Questions",
        askQuestion: "Ask question",
        filtersDescription: "Find questions quickly.",
        searchPlaceholder: "Search by title or details",
        statusAll: "All",
        statusNew: "New",
        statusAnswered: "Answered",
        questionsTitle: "Questions",
        generalCategory: "General",
      },
      questionNew: {
        title: "Ask a question",
        subtitle: "Share details so mentors can help quickly.",
        cardTitle: "New question",
        selectCategory: "Select category",
        titleLabel: "Title",
        detailsLabel: "Details",
        titlePlaceholder: "How do I remove background noise?",
        detailsPlaceholder: "Explain your context",
        submit: "Submit question",
        cancel: "Cancel",
        requiredError: "Category and title are required.",
      },
      questionNewRail: {
        examplesTitle: "Examples",
        exampleOne: "“How do I trim silence in Premiere?”",
        exampleTwo: "“Best export settings for Instagram reels?”",
        libraryTitle: "Library",
        browseLibrary: "Browse Library",
        badgeRecent: "Recent",
      },
      questionDetail: {
        title: "Question detail",
        back: "Back to questions",
        fallbackTitle: "Question",
        noDetails: "No additional details",
        pending: "Pending response.",
        watchVideo: "Watch video",
        noIdError: "No question ID provided.",
      },
      questionDetailRail: {
        relatedTitle: "Related library",
        relatedEmpty: "Recommended entries will appear here.",
        browseLibrary: "Browse library",
      },
      profileRail: {
        myQuestions: "My Questions",
        newLabel: "New",
        askQuestion: "Ask Question",
        library: "Library",
        recent: "Recent",
        saved: "Saved",
        learningIllustrationAlt: "Learning illustration",
        questionsAlt: "Questions",
        libraryAlt: "Library",
      },
      onboarding: {
        stepperTitle: "Onboarding progress",
        steps: {
          goal: "Goal",
          profile: "Profile",
          courses: "Courses",
          checkout: "Checkout",
        },
        common: {
          saving: "Saving...",
          saveAndContinue: "Save and continue",
        },
        goal: {
          title: "Choose your goal",
          subtitle: "Pick your learning track to personalize onboarding.",
          cardTitle: "Goal selection",
          cardDescription: "You can change this later.",
          noDescription: "No description",
          selectedBadge: "Selected",
          next: "Next",
          retry: "Retry",
          empty: "No goals available yet.",
          loadError: "Could not load goals.",
          saveError: "Could not save selected goal.",
        },
        profile: {
          title: "Tell us about yourself",
          subtitle: "This helps us tailor your learning path.",
          cardTitle: "Profile form",
          telegramLabel: "Telegram",
          telegramPlaceholder: "@username or https://t.me/username",
          socialUrlLabel: "Social URL",
          socialUrlPlaceholder: "https://...",
          experienceLevelLabel: "Experience level",
          experienceLevelPlaceholder: "Select level",
          experienceBeginner: "Beginner",
          experienceIntermediate: "Intermediate",
          experienceAdvanced: "Advanced",
          notesLabel: "Notes",
          notesPlaceholder: "Anything you want us to know...",
          disclaimer:
            "Your profile will be reviewed by a human. Activation is manual after review.",
          back: "Back",
          submit: "Save profile",
          next: "Next",
        },
        courses: {
          title: "Choose courses",
          subtitle: "Select one or more courses to continue.",
          cardTitle: "Course selection",
          cardDescription:
            "Choose your paid courses and optionally add community access.",
          currencyLabel: "Preferred currency",
          selected: "Selected",
          clickToSelect: "Click to select",
          totalLabel: "Total price",
          communityTitle: "Community",
          communityDescription:
            "Community access with group feedback and discussion channels.",
          inactiveSectionTitle: "Unavailable courses",
          inactiveBadge: "Inactive",
          retry: "Retry",
          loadError: "Could not load courses.",
          saveError: "Could not save selected courses.",
          currencySaveError: "Could not save preferred currency.",
          empty: "No courses selected yet.",
        },
        checkout: {
          title: "Checkout",
          subtitle: "Review your selections before payment.",
          cardTitle: "Summary",
          goalLabel: "Goal:",
          goalEmpty: "No goal selected",
          coursesLabel: "Selected courses:",
          coursesEmpty: "No courses selected",
          communityLabel: "Community",
          totalLabel: "Total price:",
          boostyCta: "Go to Boosty",
          afterPaymentTitle: "After payment",
          afterPaymentManual:
            "Activation is manual after human review. Please wait for confirmation from the team.",
          afterPaymentContactLabel: "If you have paid, message support:",
        },
      },
    },
  },
  ru: {
    common: {
      loading: "Загрузка…",
      refresh: "Обновить",
      apply: "Применить",
      clear: "Сбросить",
      open: "Открыть",
      view: "Просмотр",
      category: "Категория",
      search: "Поиск",
      allCategories: "Все категории",
      filters: "Фильтры",
      entries: "Записи",
      questions: "Вопросы",
      question: "Вопрос",
      answer: "Ответ",
      language: "Язык",
      status: {
        new: "Новые",
        answered: "Отвеченные",
        draft: "Черновик",
        published: "Опубликовано",
      },
    },
    login: {
      title: "Вход",
      subtitle: "Email/Пароль, ссылка или Google",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Пароль",
      passwordPlaceholder: "••••••••",
      signInPassword: "Войти по паролю",
      createAccount: "Создать аккаунт (email/пароль)",
      sendLink: "Отправить ссылку для входа",
      or: "или",
      continueGoogle: "Продолжить с Google",
      messages: {
        signedIn: "Вход выполнен.",
        accountCreated: "Аккаунт создан и выполнен вход.",
        googleSuccess: "Вход через Google выполнен.",
        emailLinkHint:
          "Мы отправим ссылку для входа. Если раньше вы входили паролем или Google — это нормально.",
        emailLinkSent:
          "Ссылка для входа отправлена. Откройте письмо и перейдите по ссылке.",
        emailLinkSentSetPassword:
          "Этот email уже существует. Мы отправили ссылку для входа. Откройте её, чтобы войти и включить вход по паролю.",
        linkSignedIn: "Вход по ссылке выполнен.",
        linkSignedInPasswordEnabled:
          "Вход по ссылке выполнен. Вход по паролю для этого email теперь включён.",
      },
      errors: {
        unauthorizedDomain:
          "Google вход недоступен для этого домена. Добавьте текущий домен (например, localhost) в Firebase Console → Authentication → Settings → Authorized domains.",
        accountExists:
          "Аккаунт с этим email уже существует, но использует другой способ входа. Войдите тем способом, который использовали ранее, затем привяжите Google в профиле.",
        popupClosed: "Окно входа было закрыто. Попробуйте ещё раз.",
        invalidEmail: "Некорректный email.",
        wrongPassword: "Неверный email или пароль.",
        tooManyRequests: "Слишком много попыток. Подождите и попробуйте снова.",
        missingEmail: "Укажите email.",
        emailAlreadyInUse: "Аккаунт с таким email уже существует.",
        weakPassword: "Слишком простой пароль (минимум 6 символов).",
        missingEmailForLink:
          "Введите email, на который пришла ссылка (сохранённый email не найден).",
        profileMissing: "Не удалось получить профиль пользователя после входа.",
        roleMissing: "Неверная роль пользователя.",
        generic: "Не удалось выполнить вход. Попробуйте ещё раз.",
        genericWithMessage: "Ошибка входа: {{ message }}",
      },
    },
    student: {
      layout: {
        title: "Панель студента",
        roleLabel: "Студент",
        tabs: {
          profile: "Профиль",
          questions: "Мои вопросы",
          library: "Библиотека",
        },
        reportBug: "Сообщить об ошибке",
        logout: "Выйти",
      },
      home: {
        greeting: "Привет, {{ name }}!",
        fallbackName: "друг",
        signedInAs: "Вы вошли как",
        noGoalTitle: "Цель не назначена",
        noGoalBody: "Мы сообщим вам, когда будет назначена учебная цель.",
        contactAdmin: "Связаться с админом",
        dashboardTitle: "Панель студента",
        progressComplete: "{{ percent }}% выполнено",
        goalLabel: "Цель",
        goalFallbackTitle: "Учебная цель",
        goalFallbackDescription: "Ваш персональный путь обучения.",
        goalThumbnailAlt: "Иконка цели",
        stepsTitle: "Шаги",
        stepsDescription: "Проходите путь по порядку.",
        stepsEmpty: "Шагов пока нет. Задайте вопрос или изучите библиотеку.",
        stepsAskQuestion: "Задать вопрос",
        stepsBrowseLibrary: "Открыть библиотеку",
        markDone: "Отметить как выполненное",
        markNotDone: "Снять отметку выполнения",
        currentStepTitle: "Текущий шаг",
        currentStepDescription: "Следующий невыполненный шаг вашего пути.",
        currentStepLabel: "Следующее действие",
        currentStepMaterial: "Открыть материалы",
        currentStepMarkDone: "Отметить выполненным",
        currentStepEmpty: "Все шаги выполнены. Отличная работа!",
        completeDialogTitle: "Завершить шаг",
        completeDialogDescription:
          "Добавьте комментарий и ссылку при необходимости.",
        completeDialogCommentLabel: "Комментарий (опц.)",
        completeDialogLinkLabel: "Ссылка (опц.)",
        completeDialogLinkPlaceholder: "https://...",
        completeDialogDriveHelpTitle: "Как добавить ссылку Google Drive?",
        completeDialogDriveHelpStep1: "Загрузите файл на Google Drive.",
        completeDialogDriveHelpStep2: "Откройте доступ по ссылке.",
        completeDialogDriveHelpStep3: "Установите доступ “Просматривать”.",
        completeDialogDriveHelpStep4:
          "Скопируйте ссылку и вставьте в поле выше.",
        completeDialogCancel: "Отмена",
        completeDialogConfirm: "Завершить шаг",
        completeDialogErrorTitle: "Ошибка",
        completeDialogErrorBody: "Не удалось завершить шаг",
      },
      questionsRail: {
        illustrationAlt: "Иллюстрация вопросов",
        tipsTitle: "Подсказки",
        tipOne: "Опишите, что вы уже попробовали.",
        tipTwo: "Добавьте примеры или ссылки.",
        tipThree: "Один вопрос на один запрос.",
        libraryTitle: "Библиотека",
        browseLibrary: "Открыть библиотеку",
        badgeNew: "Новое",
        saved: "Сохранённое",
      },
      library: {
        title: "Библиотека",
        filtersDescription: "Ищите по теме или категории.",
        searchPlaceholder: "Шумоподавление, свет и т. д.",
        categoryPlaceholder: "Все категории",
        entriesTitle: "Записи",
        entryThumbnailAlt: "Миниатюра записи",
        updated: "Обновлено {{ date }}",
        empty: "Нет записей, соответствующих фильтрам.",
      },
      libraryRail: {
        illustrationAlt: "Иллюстрация библиотеки",
        askTitle: "Задать вопрос",
        askBody: "Не нашли нужное?",
        askCta: "Спросить наставника",
      },
      libraryDetail: {
        title: "Запись библиотеки",
        back: "Назад к библиотеке",
        fallbackTitle: "Запись библиотеки",
        watchVideo: "Смотреть видео",
        noIdError: "Не указан идентификатор записи библиотеки.",
      },
      questions: {
        title: "Мои вопросы",
        askQuestion: "Задать вопрос",
        filtersDescription: "Быстро находите вопросы.",
        searchPlaceholder: "Искать по заголовку или деталям",
        statusAll: "Все",
        statusNew: "Новые",
        statusAnswered: "Отвеченные",
        questionsTitle: "Вопросы",
        generalCategory: "Общее",
      },
      questionNew: {
        title: "Задать вопрос",
        subtitle: "Поделитесь деталями, чтобы наставники могли помочь быстрее.",
        cardTitle: "Новый вопрос",
        selectCategory: "Выберите категорию",
        titleLabel: "Заголовок",
        detailsLabel: "Подробности",
        titlePlaceholder: "Как убрать фоновый шум?",
        detailsPlaceholder: "Опишите ваш контекст",
        submit: "Отправить вопрос",
        cancel: "Отмена",
        requiredError: "Категория и заголовок обязательны.",
      },
      questionNewRail: {
        examplesTitle: "Примеры",
        exampleOne: "«Как обрезать тишину в Premiere?»",
        exampleTwo: "«Лучшие настройки экспорта для Reels?»",
        libraryTitle: "Библиотека",
        browseLibrary: "Открыть библиотеку",
        badgeRecent: "Недавно",
      },
      questionDetail: {
        title: "Детали вопроса",
        back: "Назад к вопросам",
        fallbackTitle: "Вопрос",
        noDetails: "Нет дополнительных деталей",
        pending: "Ответ готовится.",
        watchVideo: "Смотреть видео",
        noIdError: "Не указан идентификатор вопроса.",
      },
      questionDetailRail: {
        relatedTitle: "Похожие материалы",
        relatedEmpty: "Рекомендуемые материалы появятся здесь.",
        browseLibrary: "Открыть библиотеку",
      },
      profileRail: {
        myQuestions: "Мои вопросы",
        newLabel: "Новые",
        askQuestion: "Задать вопрос",
        library: "Библиотека",
        recent: "Недавние",
        saved: "Сохранено",
        learningIllustrationAlt: "Иллюстрация обучения",
        questionsAlt: "Вопросы",
        libraryAlt: "Библиотека",
      },
      onboarding: {
        stepperTitle: "Прогресс онбординга",
        steps: {
          goal: "Цель",
          profile: "Профиль",
          courses: "Курсы",
          checkout: "Оплата",
        },
        common: {
          saving: "Сохранение...",
          saveAndContinue: "Сохранить и продолжить",
        },
        goal: {
          title: "Выберите цель",
          subtitle: "Это поможет персонализировать путь обучения.",
          cardTitle: "Выбор цели",
          cardDescription: "Позже это можно изменить.",
          noDescription: "Описание отсутствует",
          selectedBadge: "Выбрано",
          next: "Далее",
          retry: "Повторить",
          empty: "Пока нет доступных целей.",
          loadError: "Не удалось загрузить цели.",
          saveError: "Не удалось сохранить выбранную цель.",
        },
        profile: {
          title: "Расскажите о себе",
          subtitle: "Это поможет нам точнее подобрать программу.",
          cardTitle: "Анкета",
          telegramLabel: "Telegram",
          telegramPlaceholder: "@username или https://t.me/username",
          socialUrlLabel: "Ссылка на соцсеть",
          socialUrlPlaceholder: "https://...",
          experienceLevelLabel: "Уровень подготовки",
          experienceLevelPlaceholder: "Выберите уровень",
          experienceBeginner: "Начинающий",
          experienceIntermediate: "Средний",
          experienceAdvanced: "Продвинутый",
          notesLabel: "Комментарий",
          notesPlaceholder: "Что нам важно знать о вас...",
          disclaimer:
            "Профиль проверяет человек. Активация выполняется вручную после проверки.",
          back: "Назад",
          submit: "Сохранить профиль",
          next: "Далее",
        },
        courses: {
          title: "Выберите курсы",
          subtitle: "Добавьте один или несколько курсов для продолжения.",
          cardTitle: "Выбор курсов",
          cardDescription:
            "Выберите платные курсы и при желании добавьте доступ в сообщество.",
          currencyLabel: "Предпочитаемая валюта",
          selected: "Выбрано",
          clickToSelect: "Нажмите, чтобы выбрать",
          totalLabel: "Итоговая стоимость",
          communityTitle: "Сообщество",
          communityDescription:
            "Доступ в комьюнити с групповым фидбеком и каналами обсуждения.",
          inactiveSectionTitle: "Недоступные курсы",
          inactiveBadge: "Неактивен",
          retry: "Повторить",
          loadError: "Не удалось загрузить курсы.",
          saveError: "Не удалось сохранить выбранные курсы.",
          currencySaveError: "Не удалось сохранить предпочитаемую валюту.",
          empty: "Курсы пока не выбраны.",
        },
        checkout: {
          title: "Оплата",
          subtitle: "Проверьте выбранное перед оплатой.",
          cardTitle: "Сводка",
          goalLabel: "Цель:",
          goalEmpty: "Цель не выбрана",
          coursesLabel: "Выбранные курсы:",
          coursesEmpty: "Курсы не выбраны",
          communityLabel: "Комьюнити",
          totalLabel: "Итого:",
          boostyCta: "Перейти в Boosty",
          afterPaymentTitle: "После оплаты",
          afterPaymentManual:
            "Активация выполняется вручную после проверки человеком. Пожалуйста, дождитесь подтверждения от команды.",
          afterPaymentContactLabel: "Если вы оплатили, напишите в поддержку:",
        },
      },
    },
  },
};

type Dictionary = i18n.Flatten<RawDictionary>;

type I18nContextValue = {
  locale: () => Locale;
  setLocale: (next: Locale) => void;
  t: (
    key: keyof Dictionary | string,
    params?: Record<string, string | number>,
  ) => string;
  formatDate: (value?: unknown) => string;
};

const I18nContext = createContext<I18nContextValue>();

const isLocale = (value: string): value is Locale =>
  value === "en" || value === "ru";

const getInitialLocale = (): Locale => {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("locale");
    if (stored && isLocale(stored)) return stored;
  }
  if (typeof navigator !== "undefined") {
    const language = navigator.language.toLowerCase();
    if (language.startsWith("ru")) return "ru";
  }
  return "en";
};

export function I18nProvider(props: { children: JSX.Element }) {
  const [locale, setLocale] = createSignal<Locale>(getInitialLocale());

  const dict = createMemo<Dictionary>(() =>
    i18n.flatten(dictionaries[locale()]),
  );

  const t = i18n.translator(
    dict,
    i18n.resolveTemplate,
  ) as I18nContextValue["t"];

  const formatter = createMemo(
    () =>
      new Intl.DateTimeFormat(locale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  );

  const formatDate = (value?: unknown) => {
    if (!value) return "";
    const maybe = value as { toDate?: () => Date };
    if (maybe?.toDate) return formatter().format(maybe.toDate());
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return formatter().format(date);
    }
    return "";
  };

  const setLocaleSafe = (next: Locale) => {
    setLocale(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("locale", next);
    }
  };

  const value: I18nContextValue = {
    locale,
    setLocale: setLocaleSafe,
    t,
    formatDate,
  };

  return (
    <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export type { Locale };
