import {
  createContext,
  createMemo,
  createSignal,
  useContext,
  type JSX,
} from "solid-js";
import * as i18n from "@solid-primitives/i18n";

type StartSection = {
  eyebrow: string;
  stepperTitle: string;
  steps: {
    channel: string;
    topic: string;
    goal: string;
    plan: string;
    payment: string;
  };
  stepPlanExpert: string;
  quotes: {
    label: string;
    show: string;
    ford: { text: string; author: string };
    clearGoal: string;
    fromResult: string;
    yourAnswers: string;
  };
  summary: { title: string };
  expert: {
    title: string;
    body: string;
    subscriptionTitle: string;
    subscriptionBody: string;
    subscriptionCta: string;
    nextTitle: string;
    nextBody: string;
    supportLabel: string;
    toDashboard: string;
    invoiceTitle: string;
    invoiceEmpty: string;
    invoiceCodeLabel: string;
    invoiceNoteLabel: string;
    invoicePayCta: string;
    invoiceLessonsLabel: string;
  };
  panel: {
    title: string;
    channelName: string;
    topic: string;
    subscribers: string;
    videos: string;
    views: string;
    monetization: string;
    currentGoal: string;
    empty: string;
    monetizationOn: string;
    monetizationOff: string;
  };
  channel: {
    title: string;
    subtitle: string;
    question: string;
    answerNo: string;
    answerYes: string;
    linkHint: string;
    linkLabel: string;
    linkPlaceholder: string;
    check: string;
    checking: string;
    found: string;
    manualTitle: string;
    manualHint: string;
    manualLabel: string;
    manualApply: string;
    next: string;
    errorUnsupported: string;
    errorNotFound: string;
    errorRateLimited: string;
    errorFailed: string;
    errorManualRequired: string;
  };
  topic: {
    title: string;
    subtitle: string;
    question: string;
    hint: string;
    formatQuestion: string;
    lifestyleLocked: string;
    voiceoverTitle: string;
    voiceoverBody: string;
    voiceoverOk: string;
    next: string;
    back: string;
    errorTopicRequired: string;
  };
  goal: {
    title: string;
    subtitle: string;
    purposeQuestion: string;
    monetizationQuestion: string;
    monetizationYes: string;
    monetizationNo: string;
    milestoneQuestion: string;
    milestoneBelowThousand: string;
    recommended: string;
    next: string;
    back: string;
    errorPurposeRequired: string;
    errorMonetizationRequired: string;
    errorMilestoneRequired: string;
  };
  plan: {
    title: string;
    subtitle: string;
    expertTitle: string;
    expertBody: string;
    lessonsCount: string;
    goalLabel: string;
    goalValue: string;
    showPath: string;
    hidePath: string;
    tabCourses: string;
    tabPath: string;
    wholeCourse: string;
    individualLessons: string;
    perLesson: string;
    total: string;
    selectAtLeastOne: string;
    pathEmpty: string;
    selectedLessonsCount: string;
    register: string;
    continue: string;
    back: string;
    loadError: string;
    retry: string;
    empty: string;
    excludedNote: string;
  };
  topics: Record<
    | "movies_anime"
    | "games"
    | "education"
    | "business"
    | "tech_ai"
    | "lifestyle"
    | "beauty"
    | "health"
    | "food"
    | "travel"
    | "family"
    | "psychology"
    | "news"
    | "music"
    | "sport"
    | "humor"
    | "true_crime",
    string
  >;
  formats: Record<"live" | "talking_head" | "voiceover", string>;
  purposes: Record<"earn" | "business" | "community" | "creative", string>;
  milestones: Record<
    | "first_video"
    | "views_10k"
    | "subs_1k_hours_4k"
    | "hours_4k"
    | "subs_2k"
    | "subs_5k"
    | "subs_10k"
    | "subs_25k"
    | "subs_50k"
    | "subs_100k",
    string
  >;
};

type RawDictionary = {
  start: StartSection;
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
    settings: string;
    appearance: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    renameUser: string;
    save: string;
    cancel: string;
    logout: string;
    active: string;
    valueRequired: string;
    maxLength60: string;
    saveFailed: string;
    contactSupport: string;
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
    modeSignIn: string;
    modeSignUp: string;
    signInTitle: string;
    signInSubtitle: string;
    signUpTitle: string;
    signUpSubtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    forgotPassword: string;
    signInPassword: string;
    createAccount: string;
    sendLink: string;
    or: string;
    continueGoogle: string;
    switchToSignIn: string;
    switchToSignUp: string;
    accessGateLabel: string;
    platformTitle: string;
    platformTitleRegister: string;
    methodEmail: string;
    methodRegister: string;
    methodTelegram: string;
    methodGoogle: string;
    subTabPassword: string;
    subTabLink: string;
    sslLabel: string;
    versionLabel: string;
    telegramTitle: string;
    telegramSoon: string;
    messages: {
      signedIn: string;
      accountCreated: string;
      googleSuccess: string;
      emailLinkHint: string;
      emailLinkSent: string;
      emailLinkSentSetPassword: string;
      linkSignedIn: string;
      linkSignedInPasswordEnabled: string;
      passwordResetSent: string;
    };
    errors: {
      unauthorizedDomain: string;
      accountExists: string;
      popupClosed: string;
      invalidEmail: string;
      wrongPassword: string;
      tooManyRequests: string;
      missingEmail: string;
      missingPassword: string;
      emailAlreadyInUse: string;
      weakPassword: string;
      missingEmailForLink: string;
      profileMissing: string;
      roleMissing: string;
      generic: string;
      genericWithMessage: string;
    };
  };
  blocked: {
    titleDisabled: string;
    descriptionDisabled: string;
    titleExpired: string;
    descriptionExpired: string;
    renewalMessage: string;
    continueOnboarding: string;
    logout: string;
  };
  student: {
    layout: {
      title: string;
      roleLabel: string;
      brand: string;
      searchPlaceholder: string;
      levelLabel: string;
      workspaceTitle: string;
      workspaceSubtitle: string;
      navDashboard: string;
      navCourses: string;
      navLibrary: string;
      navCommunity: string;
      tipTitle: string;
      tipBody: string;
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
      progressCounter: string;
      goalLabel: string;
      goalFallbackTitle: string;
      goalFallbackDescription: string;
      goalThumbnailAlt: string;
      stepsTitle: string;
      stepsDescription: string;
      stepsEmpty: string;
      coursesEmpty: string;
      chooseCourses: string;
      legacyCourseTitle: string;
      courseTabEyebrow: string;
      courseProgress: string;
      courseStepsEmpty: string;
      trialLesson: string;
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
      stepLocked: string;
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
      greetingEyebrow: string;
      welcomeBack: string;
      weeklyGoalProgress: string;
      statusInProgress: string;
      progressLabel: string;
      continueJourney: string;
      ongoingCourses: string;
      completedLessons: string;
      nextMilestone: string;
      milestoneProgress: string;
      recentActivityTitle: string;
      viewAll: string;
      activityCurrentFocus: string;
      activityCompletedStep: string;
      activityGoalProgress: string;
      resourcesTitle: string;
      resourceLatestMaterial: string;
      resourceSavedDocuments: string;
      resourceMentorSupport: string;
      browseFullLibrary: string;
      pathMapAriaLabel: string;
      doneCommentLabel: string;
      doneLinkLabel: string;
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
      courses: string;
      coursesBody: string;
      browseCourses: string;
      learningIllustrationAlt: string;
      questionsAlt: string;
      libraryAlt: string;
    };
    courses: {
      title: string;
      description: string;
      loading: string;
      emptyAvailable: string;
      selectedCount: string;
      createPaymentInstructions: string;
      ownedTitle: string;
      paymentInstructionsTitle: string;
      activationCode: string;
      amount: string;
      openPaymentPage: string;
      refreshCourses: string;
      selectAtLeastOne: string;
      freeAccessHint: string;
      buyLesson: string;
      lessonPrice: string;
      ownedLesson: string;
      lessonMode: string;
      courseMode: string;
      upgradeHint: string;
      lessonsNotAvailable: string;
    };
    onboarding: {
      common: {
        saving: string;
        saveAndContinue: string;
      };
      profile: {
        title: string;
        subtitle: string;
        cardTitle: string;
        cardDescription: string;
        firstNameLabel: string;
        firstNamePlaceholder: string;
        lastNameLabel: string;
        lastNamePlaceholder: string;
        emailLabel: string;
        aboutMeLabel: string;
        aboutMePlaceholder: string;
        aboutMeRequired: string;
        telegramLabel: string;
        telegramPlaceholder: string;
        telegramHelp: string;
        telegramRequired: string;
        telegramPhoneError: string;
        socialLinksLabel: string;
        socialLinkPlaceholder: string;
        socialLinkError: string;
        addSocialLink: string;
        removeSocialLink: string;
        disclaimer: string;
        back: string;
        submit: string;
        next: string;
      };
      checkout: {
        title: string;
        subtitle: string;
        cardTitle: string;
        goalLabel: string;
        goalEmpty: string;
        coursesLabel: string;
        coursesEmpty: string;
        lessonsLabel: string;
        communityLabel: string;
        totalLabel: string;
        boostyCta: string;
        firstHundredCardTitle: string;
        firstHundredCardBody: string;
        afterPaymentTitle: string;
        afterPaymentManual: string;
        afterPaymentFree: string;
        activatedMessage: string;
        dashboardCta: string;
        afterPaymentContactLabel: string;
        removeCourse: string;
        backToCourses: string;
        removeError: string;
        saveError: string;
      };
    };
  };
};

type Locale = "en" | "ru";

const dictionaries: Record<Locale, RawDictionary> = {
  en: {
    start: {
      eyebrow: "Getting started",
      stepperTitle: "Your first steps",
      steps: {
        channel: "Channel",
        topic: "Topic",
        goal: "Goal",
        plan: "Plan",
        payment: "Payment",
      },
      stepPlanExpert: "Expert",
      quotes: {
        label: "Quotes",
        show: "Show quote {{ number }}",
        ford: {
          text: "Any great goal can be reached if you break it into clear steps.",
          author: "Henry Ford",
        },
        clearGoal: "A clear goal turns learning into a route, not a pile of lessons.",
        fromResult: "The path works best when it starts from the result you want.",
        yourAnswers: "Your answers help us remove noise and keep the route practical.",
      },
      summary: { title: "Channel information" },
      expert: {
        title: "An expert is building your path",
        body: "Your channel already has history, so your learning path is built together with a live expert. We have your answers - our expert will contact you in Telegram to agree on the next steps.",
        subscriptionTitle: "Join the community",
        subscriptionBody:
          "The community subscription is paid right away and opens access to the club. Lessons chosen with the expert are invoiced separately after the consultation.",
        subscriptionCta: "Pay on Boosty",
        nextTitle: "What happens next",
        nextBody:
          "After the consultation the expert puts your path together and sends an invoice for the lessons you agreed on. You will see it in your account.",
        supportLabel: "Questions:",
        toDashboard: "Go to my account",
        invoiceTitle: "Your invoice",
        invoiceEmpty:
          "No invoice yet. It appears here after the expert agrees the lessons with you.",
        invoiceCodeLabel: "Activation code",
        invoiceNoteLabel: "Comment",
        invoicePayCta: "Pay on Boosty",
        invoiceLessonsLabel: "Lessons",
      },
      panel: {
        title: "Your channel",
        channelName: "Channel name",
        topic: "Topic",
        subscribers: "Subscribers",
        videos: "Videos published",
        views: "Views",
        monetization: "Monetization",
        currentGoal: "Current goal",
        empty: "—",
        monetizationOn: "Enabled",
        monetizationOff: "Not yet",
      },
      channel: {
        title: "Do you already have a YouTube channel?",
        subtitle: "We use the answer to build your personal path.",
        question: "Do you already have a YouTube channel, or do you want to start one?",
        answerNo: "No",
        answerYes: "Yes, I have one",
        linkHint:
          "Paste a link to your channel and we will read its current numbers and take them into account while building your personal path.",
        linkLabel: "Channel link",
        linkPlaceholder: "youtube.com/@yourchannel",
        check: "Check channel",
        checking: "Checking…",
        found: "Channel found",
        manualTitle: "Enter the numbers yourself",
        manualHint:
          "This channel hides its subscriber count, so please type it in - we need it to pick your next goal.",
        manualLabel: "Subscribers",
        manualApply: "Save number",
        next: "Continue",
        errorUnsupported:
          "Send a link like youtube.com/@handle or youtube.com/channel/UC…",
        errorNotFound: "We could not find this channel. Check the link, please.",
        errorRateLimited: "Too many checks. Try again in a minute.",
        errorFailed:
          "YouTube did not answer. Enter your subscriber count manually to continue.",
        errorManualRequired: "Enter your subscriber count to continue.",
      },
      topic: {
        title: "Pick your topic and format",
        subtitle:
          "We cannot detect them from the link yet, so please answer these two questions.",
        question:
          "Which topic would you like to work in? Nothing is locked in - you can change it later.",
        hint: "Pick the closest one.",
        formatQuestion: "Choose the format of your videos",
        lifestyleLocked:
          "Lifestyle and vlog means live dynamic shooting, so the format is fixed.",
        voiceoverTitle: "Filming is out of your path",
        voiceoverBody:
          "Since you picked the voiceover format, you do not need to learn filming at this stage. We will drop that block from your path, and you can add it later.",
        voiceoverOk: "Got it",
        next: "Continue",
        back: "Back",
        errorTopicRequired: "Pick a topic and a format to continue.",
      },
      goal: {
        title: "Set your goal",
        subtitle: "It becomes the finish line of your first path.",
        purposeQuestion: "What is the main goal of starting a YouTube channel?",
        monetizationQuestion: "Is monetization enabled on the channel?",
        monetizationYes: "Yes, the channel is monetized",
        monetizationNo: "Not yet",
        milestoneQuestion: "Pick the goal you want to reach next.",
        milestoneBelowThousand:
          "Your next goal is the monetization threshold: 1000 subscribers and 4000 watch hours.",
        recommended: "Recommended",
        next: "Continue",
        back: "Back",
        errorPurposeRequired: "Pick a goal to continue.",
        errorMonetizationRequired: "Answer the monetization question to continue.",
        errorMilestoneRequired: "Pick a goal to continue.",
      },
      plan: {
        title: "Your learning path",
        subtitle: "These are the lessons waiting for you.",
        expertTitle: "An expert will build your path",
        expertBody:
          "Your channel already has history, so your learning path should be built together with a live expert. Sign up and our expert will contact you to help.",
        lessonsCount: "Lessons: {{ count }}",
        goalLabel: "Your goal:",
        goalValue: "Become a YouTube blogger",
        showPath: "Show path",
        hidePath: "Hide path",
        tabCourses: "Courses",
        tabPath: "Selected path",
        wholeCourse: "Whole course",
        individualLessons: "Pick individual lessons",
        perLesson: "per lesson",
        total: "Total",
        selectAtLeastOne: "Pick at least one course or lesson to continue.",
        pathEmpty: "Nothing selected yet.",
        selectedLessonsCount: "Selected: {{ count }}",
        register: "Sign up",
        continue: "Continue",
        back: "Back",
        loadError: "Could not load the path.",
        retry: "Try again",
        empty: "No courses for this goal yet.",
        excludedNote: "Filming lessons are excluded for the voiceover format.",
      },
      topics: {
        movies_anime: "Movies, series, anime",
        games: "Games",
        education: "Education",
        business: "Business, money",
        tech_ai: "Technology, AI",
        lifestyle: "Lifestyle, vlog",
        beauty: "Beauty, fashion",
        health: "Health, fitness",
        food: "Food, cooking",
        travel: "Travel",
        family: "Family, kids",
        psychology: "Psychology, relationships",
        news: "News, politics",
        music: "Music",
        sport: "Sport",
        humor: "Humor, entertainment",
        true_crime: "True crime, mystery",
      },
      formats: {
        live: "Live dynamic shooting",
        talking_head: "Talking head",
        voiceover: "Voiceover",
      },
      purposes: {
        earn: "I want to earn as a YouTuber",
        business: "I want to promote my business on YouTube",
        community: "I want to find like-minded people",
        creative: "I just want a creative outlet",
      },
      milestones: {
        first_video: "Publish the first video",
        views_10k: "First 10,000 views",
        subs_1k_hours_4k: "1000 subscribers and 4000 watch hours",
        hours_4k: "4000 watch hours",
        subs_2k: "2000 subscribers",
        subs_5k: "5000 subscribers",
        subs_10k: "10,000 subscribers",
        subs_25k: "25,000 subscribers",
        subs_50k: "50,000 subscribers",
        subs_100k: "100,000 subscribers",
      },
    },
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
      settings: "Settings",
      appearance: "Appearance",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      renameUser: "Rename user",
      save: "Save",
      cancel: "Cancel",
      logout: "Logout",
      active: "Active",
      valueRequired: "Value is required.",
      maxLength60: "Must be 60 characters or fewer.",
      saveFailed: "Save failed.",
      contactSupport: "Contact Support",
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
      modeSignIn: "Sign in",
      modeSignUp: "Register",
      signInTitle: "Welcome back",
      signInSubtitle: "Use password, email link, or Google to continue.",
      signUpTitle: "Create your account",
      signUpSubtitle:
        "Register with email and password or continue with Google.",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      forgotPassword: "Forgot password?",
      signInPassword: "Sign in with password",
      createAccount: "Create account (email/password)",
      sendLink: "Send sign-in link (passwordless)",
      or: "or",
      continueGoogle: "Continue with Google",
      switchToSignIn: "Already have an account? Sign in",
      switchToSignUp: "Need an account? Register",
      accessGateLabel: "STORYWALKERS ACCESS GATE",
      platformTitle: "Sign in to platform",
      platformTitleRegister: "Create account",
      methodEmail: "By Email",
      methodRegister: "Register",
      methodTelegram: "Telegram",
      methodGoogle: "Google",
      subTabPassword: "Password",
      subTabLink: "Magic Link",
      sslLabel: "SSL Encryption",
      versionLabel: "StoryWalkers ID v2.6",
      telegramTitle: "Sign in via Telegram",
      telegramSoon: "Coming soon",
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
        passwordResetSent:
          "Password reset email sent. Check your inbox for next steps.",
      },
      errors: {
        unauthorizedDomain:
          "Google sign-in is not available right now. Please use email login for the moment or try again a bit later.",
        accountExists:
          "This email is already linked to another sign-in method. Try the method you used before, then you can connect the others later.",
        popupClosed: "The sign-in window was closed before completion. Try again when you're ready.",
        invalidEmail: "That email does not look right. Please check it and try again.",
        wrongPassword: "We couldn't sign you in with that email and password. Check them and try again.",
        tooManyRequests: "There were too many attempts in a short time. Please wait a little and try again.",
        missingEmail: "Please enter your email first.",
        missingPassword: "Please enter your password first.",
        emailAlreadyInUse:
          "An account with this email already exists. Try signing in instead of registering.",
        weakPassword:
          "Choose a stronger password. It should be at least 6 characters long.",
        missingEmailForLink:
          "Please enter the email address where you received the sign-in link.",
        profileMissing:
          "You signed in, but we couldn't finish loading your profile. Please try again in a moment.",
        roleMissing:
          "We couldn't determine access for this account yet. Please contact support if this keeps happening.",
        generic:
          "Something went wrong during sign-in. Please try again in a moment.",
        genericWithMessage:
          "Something went wrong during sign-in. Please try again in a moment.",
      },
    },
    blocked: {
      titleDisabled: "Account disabled",
      descriptionDisabled:
        "Your account is currently disabled. Access to protected sections is restricted.",
      titleExpired: "Access expired",
      descriptionExpired:
        "Your access period has ended. Some sections are unavailable until renewal.",
      renewalMessage:
        "To continue learning, contact support and request renewal.",
      continueOnboarding: "Continue onboarding",
      logout: "Log out",
    },
    student: {
      layout: {
        title: "Student Dashboard",
        roleLabel: "Student",
        brand: "StoryWalkers Club",
        searchPlaceholder: "Search archive...",
        levelLabel: "Level {{ level }}",
        workspaceTitle: "StoryWalkers",
        workspaceSubtitle: "",
        navDashboard: "Dashboard",
        navCourses: "My Courses",
        navLibrary: "Library",
        navCommunity: "Community",
        tipTitle: "Pro Tip",
        tipBody: "Complete 3 lessons to unlock the “Gold Quill” badge.",
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
        progressCounter: "{{ done }} / {{ total }} steps completed",
        goalLabel: "Goal",
        goalFallbackTitle: "Learning goal",
        goalFallbackDescription: "Your personalized learning path.",
        goalThumbnailAlt: "Goal thumbnail",
        stepsTitle: "Path steps",
        stepsDescription: "Work through your path in order.",
        stepsEmpty: "No steps yet. Ask a question or explore the library.",
        coursesEmpty: "No courses are available yet.",
        chooseCourses: "Choose courses",
        legacyCourseTitle: "General path",
        courseTabEyebrow: "Course path",
        courseProgress: "{{ done }} of {{ total }} steps completed · {{ percent }}%",
        courseStepsEmpty: "No path steps have been added for this course yet.",
        trialLesson: "Watch trial lesson",
        stepsAskQuestion: "Ask a question",
        stepsBrowseLibrary: "Browse library",
        markDone: "Mark as complete",
        markNotDone: "Mark as incomplete",
        currentStepTitle: "Current step",
        currentStepDescription:
          "Focus on the next unfinished step in your path.",
        currentStepLabel: "Up next",
        currentStepMaterial: "View material",
        currentStepMarkDone: "Mark done",
        currentStepEmpty: "You’ve completed every step. Great work!",
        stepLocked: "Complete the previous steps first",
        completeDialogTitle: "Complete step",
        completeDialogDescription: "Add a comment or link if needed.",
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
        greetingEyebrow: "Your learning space",
        welcomeBack: "Welcome back, {{ name }}",
        weeklyGoalProgress:
          "Your learning path is waiting. You’ve completed {{ percent }}% of your goal.",
        statusInProgress: "In Progress",
        progressLabel: "Progress",
        continueJourney: "Continue Journey",
        ongoingCourses: "Current Path",
        completedLessons: "Completed Steps",
        nextMilestone: "Next milestone",
        milestoneProgress: "{{ done }} of {{ total }} steps completed",
        recentActivityTitle: "Recent Activity",
        viewAll: "View All",
        activityCurrentFocus: "Current focus",
        activityCompletedStep: "Completed step",
        activityGoalProgress: "Goal progress",
        resourcesTitle: "Learning resources",
        resourceLatestMaterial: "Latest material",
        resourceSavedDocuments: "Saved documents",
        resourceMentorSupport: "Mentor support",
        browseFullLibrary: "Browse full library",
        pathMapAriaLabel: "Learning path map",
        doneCommentLabel: "Comment:",
        doneLinkLabel: "Link:",
      },
      questionsRail: {
        illustrationAlt: "Questions illustration",
        tipsTitle: "Tips",
        tipOne: "Describe what you have already tried.",
        tipTwo: "Add references, screenshots, or examples.",
        tipThree: "Keep each post focused on one question.",
        libraryTitle: "Library",
        browseLibrary: "Browse library",
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
        askBody: "Can’t find the answer you need?",
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
        askQuestion: "Ask a question",
        filtersDescription: "Search by title, details, or status.",
        searchPlaceholder: "Search by title or details",
        statusAll: "All",
        statusNew: "New",
        statusAnswered: "Answered",
        questionsTitle: "Questions",
        generalCategory: "General",
      },
      questionNew: {
        title: "Ask a question",
        subtitle: "Add enough context so mentors can help you faster.",
        cardTitle: "New question",
        selectCategory: "Select category",
        titleLabel: "Title",
        detailsLabel: "Details",
        titlePlaceholder: "How do I remove background noise?",
        detailsPlaceholder: "Describe your situation and what you need help with",
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
        relatedTitle: "Related materials",
        relatedEmpty: "Recommended entries will appear here.",
        browseLibrary: "Browse library",
      },
      profileRail: {
        myQuestions: "My Questions",
        newLabel: "New",
        askQuestion: "Ask a question",
        library: "Library",
        recent: "Recent",
        saved: "Saved",
        courses: "Courses",
        coursesBody:
          "Add more courses to your plan after payment is confirmed.",
        browseCourses: "Browse courses",
        learningIllustrationAlt: "Learning illustration",
        questionsAlt: "Questions",
        libraryAlt: "Library",
      },
      courses: {
        title: "Additional courses",
        description:
          "Choose extra courses to add to your learning plan after payment is confirmed.",
        loading: "Loading courses…",
        emptyAvailable: "No additional courses are available right now.",
        selectedCount: "{{ count }} selected",
        createPaymentInstructions: "Create payment instructions",
        ownedTitle: "Your courses",
        paymentInstructionsTitle: "Payment instructions",
        activationCode: "Activation code",
        amount: "Amount: {{ amount }}",
        openPaymentPage: "Open payment page",
        refreshCourses: "Refresh courses",
        selectAtLeastOne: "Select at least one course.",
        freeAccessHint:
          "You are among the first 100 students. These courses are free for you.",
        buyLesson: "Buy lesson",
        lessonPrice: "per lesson",
        ownedLesson: "Owned",
        lessonMode: "Buy individual lessons",
        courseMode: "Buy whole course",
        upgradeHint:
          "You own {{ count }} lessons from this course. Upgrade price: {{ price }}",
        lessonsNotAvailable: "Individual lessons are not available for this course.",
      },
    onboarding: {
        common: {
          saving: "Saving...",
          saveAndContinue: "Save and continue",
        },
        profile: {
          title: "Tell us about yourself",
          subtitle:
            "This step is about your personal information. You can stay anonymous and share as much or as little as you want. At the same time, the better our team knows you, the easier it is for us to support your learning. We review the social links you share and use that context to optimize the learning process.",
          cardTitle: "Profile",
          cardDescription:
            "Start with your basic profile info. Telegram is required. Social links are optional.",
          firstNameLabel: "First name",
          firstNamePlaceholder: "Alex",
          lastNameLabel: "Last name",
          lastNamePlaceholder: "Doe",
          emailLabel: "Email",
          aboutMeLabel: "About me",
          aboutMePlaceholder:
            "Tell us about your goals, current level, and what you want from StoryWalkers.",
          aboutMeRequired: "About me is required.",
          telegramLabel: "Telegram",
          telegramPlaceholder: "@username",
          telegramHelp:
            "We add “@” automatically for Telegram handles. Phone numbers are not accepted here.",
          telegramRequired: "Telegram is required.",
          telegramPhoneError: "Telegram must be a handle, not a phone number.",
          socialLinksLabel: "Social links",
          socialLinkPlaceholder: "https://instagram.com/yourname",
          socialLinkError: "Each social link must be a valid URL.",
          addSocialLink: "Add link",
          removeSocialLink: "Remove link",
          disclaimer:
            "Your profile will be reviewed by a human. Activation is manual after review.",
          back: "Back",
          submit: "Save profile",
          next: "Next",
        },
        checkout: {
          title: "Payment",
          subtitle: "Review your selections before payment.",
          cardTitle: "Summary",
          goalLabel: "Goal:",
          goalEmpty: "No goal selected",
          coursesLabel: "Selected paths:",
          coursesEmpty: "No paths selected",
          lessonsLabel: "Selected lessons:",
          communityLabel: "StoryWalkers Community",
          totalLabel: "Total price:",
          boostyCta: "Go to Boosty",
          firstHundredCardTitle: "Congratulations!",
          firstHundredCardBody:
            "You are one of the first 100 students on our platform. All current and future courses will be free for you.",
          afterPaymentTitle: "Next steps",
          afterPaymentManual:
            "Access is activated manually after review. Please wait for confirmation from the team.",
          afterPaymentFree:
            "You are among the first 100 students. Access opens automatically.",
          activatedMessage: "Your access is open.",
          dashboardCta: "Go to dashboard",
          afterPaymentContactLabel: "If you have paid, message support:",
          removeCourse: "Remove",
          backToCourses: "Back to path selection",
          removeError: "Could not update selected paths.",
          saveError: "Could not save selected paths.",
        },
      },
    },
  },
  ru: {
    start: {
      eyebrow: "Начало",
      stepperTitle: "Ваши первые шаги",
      steps: {
        channel: "Канал",
        topic: "Тематика",
        goal: "Цель",
        plan: "План",
        payment: "Оплата",
      },
      stepPlanExpert: "Эксперт",
      quotes: {
        label: "Цитаты",
        show: "Показать цитату {{ number }}",
        ford: {
          text: "Любую великую цель можно достичь, если разбить её на понятные шаги.",
          author: "Генри Форд",
        },
        clearGoal: "Четкая цель превращает обучение в маршрут, а не в набор уроков.",
        fromResult: "Путь работает лучше, когда начинается с результата, к которому вы идете.",
        yourAnswers: "Ваши ответы помогают убрать лишнее и оставить практичный маршрут.",
      },
      summary: { title: "Информация о канале" },
      expert: {
        title: "Эксперт составляет ваш путь",
        body: "У вашего канала уже есть история, поэтому план обучения составляется с живым представителем. Ваши ответы у нас — эксперт свяжется с вами в Telegram, чтобы обсудить следующие шаги.",
        subscriptionTitle: "Подписка на сообщество",
        subscriptionBody:
          "Подписка на сообщество оплачивается сразу и открывает доступ в клуб. Уроки, выбранные вместе с экспертом, оплачиваются отдельно после консультации.",
        subscriptionCta: "Перейти в Boosty",
        nextTitle: "Что дальше",
        nextBody:
          "После консультации эксперт соберёт ваш путь и выставит счёт на согласованные уроки. Вы увидите его в личном кабинете.",
        supportLabel: "Вопросы:",
        toDashboard: "Перейти в кабинет",
        invoiceTitle: "Ваш счёт",
        invoiceEmpty:
          "Счёта пока нет. Он появится здесь после того, как эксперт согласует с вами уроки.",
        invoiceCodeLabel: "Код активации",
        invoiceNoteLabel: "Комментарий",
        invoicePayCta: "Оплатить на Boosty",
        invoiceLessonsLabel: "Уроков",
      },
      panel: {
        title: "Ваш канал",
        channelName: "Имя канала",
        topic: "Тематика канала",
        subscribers: "Количество подписчиков",
        videos: "Сколько видео опубликовано",
        views: "Сколько просмотров",
        monetization: "Монетизация",
        currentGoal: "Текущая цель",
        empty: "—",
        monetizationOn: "Включена",
        monetizationOff: "Не включена",
      },
      channel: {
        title: "У вас уже есть YouTube-канал?",
        subtitle: "От ответа зависит, каким будет ваш персональный путь.",
        question:
          "У вас уже есть YouTube-канал или вы хотите создать новый с нуля?",
        answerNo: "Нет",
        answerYes: "Да, есть",
        linkHint:
          "Вставьте ссылку на канал, а мы проанализируем его текущие показатели и учтём их при создании вашего персонального пути.",
        linkLabel: "Ссылка на канал",
        linkPlaceholder: "youtube.com/@вашканал",
        check: "Проверить канал",
        checking: "Проверяем…",
        found: "Канал найден",
        manualTitle: "Введите данные вручную",
        manualHint:
          "Этот канал скрывает количество подписчиков — укажите его сами, оно нужно для выбора следующей цели.",
        manualLabel: "Подписчики",
        manualApply: "Сохранить",
        next: "Продолжить",
        errorUnsupported:
          "Пришлите ссылку вида youtube.com/@имя или youtube.com/channel/UC…",
        errorNotFound: "Не нашли такой канал. Проверьте ссылку, пожалуйста.",
        errorRateLimited: "Слишком много проверок. Попробуйте через минуту.",
        errorFailed:
          "YouTube не ответил. Чтобы продолжить, укажите количество подписчиков вручную.",
        errorManualRequired: "Укажите количество подписчиков, чтобы продолжить.",
      },
      topic: {
        title: "Выберите тематику и формат",
        subtitle:
          "К сожалению, по ссылке мы их пока не определяем — ответьте, пожалуйста, на два вопроса.",
        question:
          "Выберите, какой тематикой вам хотелось бы заниматься в ютубе. Выбор ни к чему не обязывает, вы можете потом его поменять.",
        hint: "Выберите самую близкую.",
        formatQuestion: "Выберите формат ваших видео",
        lifestyleLocked:
          "Лайфстайл и влог — это живая динамичная съёмка, поэтому формат зафиксирован.",
        voiceoverTitle: "Съёмка не войдёт в ваш путь",
        voiceoverBody:
          "Так как вы выбрали формат «голос за кадром», на этом этапе вам не нужно изучать съёмку видео. Мы исключим этот блок из вашего пути, но вы сможете добавить его позже.",
        voiceoverOk: "Понятно",
        next: "Продолжить",
        back: "Назад",
        errorTopicRequired: "Выберите тематику и формат, чтобы продолжить.",
      },
      goal: {
        title: "Поставьте цель",
        subtitle: "Она станет финишем вашего первого пути.",
        purposeQuestion: "Какая основная цель создания Ютуб-канала?",
        monetizationQuestion: "Включена ли монетизация на канале?",
        monetizationYes: "Да, канал монетизируется",
        monetizationNo: "Нет ещё",
        milestoneQuestion:
          "Выберите, какую цель вы бы хотели поставить для себя следующей.",
        milestoneBelowThousand:
          "Ваша следующая цель — порог монетизации: 1000 подписчиков и 4000 часов просмотра.",
        recommended: "Рекомендуем",
        next: "Продолжить",
        back: "Назад",
        errorPurposeRequired: "Выберите цель, чтобы продолжить.",
        errorMonetizationRequired:
          "Ответьте на вопрос о монетизации, чтобы продолжить.",
        errorMilestoneRequired: "Выберите цель, чтобы продолжить.",
      },
      plan: {
        title: "Ваш план обучения",
        subtitle: "Вот уроки, которые вас ждут.",
        expertTitle: "План составит эксперт",
        expertBody:
          "У вашего канала уже есть история, поэтому план обучения должен составляться с живым представителем. Зарегистрируйтесь у нас на сайте, и наш эксперт свяжется с вами, чтобы помочь.",
        lessonsCount: "Уроков: {{ count }}",
        goalLabel: "Ваша цель:",
        goalValue: "Стать блоггером на Ютюб",
        showPath: "Показать путь",
        hidePath: "Скрыть путь",
        tabCourses: "Курсы",
        tabPath: "Выбранный путь",
        wholeCourse: "Весь курс",
        individualLessons: "Выбрать отдельные уроки",
        perLesson: "за урок",
        total: "Итого",
        selectAtLeastOne: "Выберите хотя бы один курс или урок, чтобы продолжить.",
        pathEmpty: "Пока ничего не выбрано.",
        selectedLessonsCount: "Выбрано: {{ count }}",
        register: "Зарегистрироваться",
        continue: "Продолжить",
        back: "Назад",
        loadError: "Не удалось загрузить план.",
        retry: "Попробовать снова",
        empty: "Для этой цели пока нет курсов.",
        excludedNote: "Для формата «голос за кадром» уроки по съёмке исключены.",
      },
      topics: {
        movies_anime: "Кино, сериалы, аниме",
        games: "Игры",
        education: "Образование",
        business: "Бизнес, деньги",
        tech_ai: "Технологии, AI",
        lifestyle: "Лайфстайл, влог",
        beauty: "Красота, мода",
        health: "Здоровье, фитнес",
        food: "Еда, кулинария",
        travel: "Путешествия",
        family: "Семья, дети",
        psychology: "Психология, отношения",
        news: "Новости, политика",
        music: "Музыка",
        sport: "Спорт",
        humor: "Юмор, развлечения",
        true_crime: "Тру-крайм, мистика",
      },
      formats: {
        live: "Живая динамичная съёмка",
        talking_head: "Говорящая голова",
        voiceover: "Голос за кадром",
      },
      purposes: {
        earn: "Хочу зарабатывать как ютубер",
        business: "Хочу продвигать свой бизнес через Ютуб",
        community: "Хочу найти единомышленников",
        creative: "Хочу просто заняться творчеством для души",
      },
      milestones: {
        first_video: "Публикация первого видео",
        views_10k: "Первые 10 000 просмотров",
        subs_1k_hours_4k: "1000 подписчиков и 4000 часов просмотра",
        hours_4k: "4000 часов просмотра",
        subs_2k: "2000 подписчиков",
        subs_5k: "5000 подписчиков",
        subs_10k: "10 000 подписчиков",
        subs_25k: "25 000 подписчиков",
        subs_50k: "50 000 подписчиков",
        subs_100k: "100 000 подписчиков",
      },
    },
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
      settings: "Настройки",
      appearance: "Оформление",
      theme: "Тема",
      themeLight: "Светлая",
      themeDark: "Тёмная",
      renameUser: "Изменить имя",
      save: "Сохранить",
      cancel: "Отмена",
      logout: "Выйти",
      active: "Активно",
      valueRequired: "Значение обязательно.",
      maxLength60: "Не более 60 символов.",
      saveFailed: "Не удалось сохранить.",
      contactSupport: "Связаться с поддержкой",
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
      modeSignIn: "Вход",
      modeSignUp: "Регистрация",
      signInTitle: "С возвращением",
      signInSubtitle: "Войдите по паролю, ссылке из письма или через Google.",
      signUpTitle: "Создайте аккаунт",
      signUpSubtitle:
        "Зарегистрируйтесь по email и паролю или продолжите через Google.",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Пароль",
      passwordPlaceholder: "••••••••",
      forgotPassword: "Забыли пароль?",
      signInPassword: "Войти по паролю",
      createAccount: "Создать аккаунт (email/пароль)",
      sendLink: "Отправить ссылку для входа",
      or: "или",
      continueGoogle: "Продолжить с Google",
      switchToSignIn: "Уже есть аккаунт? Войти",
      switchToSignUp: "Нужен аккаунт? Зарегистрироваться",
      accessGateLabel: "STORYWALKERS ACCESS GATE",
      platformTitle: "Вход на платформу",
      platformTitleRegister: "Регистрация",
      methodEmail: "По Почте",
      methodRegister: "Регистрация",
      methodTelegram: "Telegram",
      methodGoogle: "Google",
      subTabPassword: "Вход по паролю",
      subTabLink: "Ссылка на почту",
      sslLabel: "SSL Шифрование",
      versionLabel: "StoryWalkers ID v2.6",
      telegramTitle: "Войти через Telegram",
      telegramSoon: "Скоро доступно",
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
        passwordResetSent:
          "Письмо для сброса пароля отправлено. Проверьте почту для дальнейших шагов.",
      },
      errors: {
        unauthorizedDomain:
          "Сейчас вход через Google недоступен. Попробуйте войти по email или повторите попытку чуть позже.",
        accountExists:
          "Этот email уже связан с другим способом входа. Попробуйте тот способ, которым входили раньше, а затем при необходимости привяжете остальные.",
        popupClosed: "Окно входа закрылось раньше времени. Попробуйте ещё раз.",
        invalidEmail: "Похоже, email введён с ошибкой. Проверьте его и попробуйте снова.",
        wrongPassword:
          "Не удалось войти с этим email и паролем. Проверьте данные и попробуйте ещё раз.",
        tooManyRequests:
          "Слишком много попыток за короткое время. Немного подождите и попробуйте снова.",
        missingEmail: "Сначала укажите email.",
        missingPassword: "Сначала введите пароль.",
        emailAlreadyInUse:
          "Аккаунт с таким email уже есть. Попробуйте войти, а не создавать новый.",
        weakPassword:
          "Придумайте пароль посильнее. Нужны минимум 6 символов.",
        missingEmailForLink:
          "Введите email, на который пришла ссылка для входа.",
        profileMissing:
          "Войти удалось, но профиль пока не загрузился. Попробуйте ещё раз через минуту.",
        roleMissing:
          "Не удалось определить доступ для этого аккаунта. Если ошибка повторится, напишите в поддержку.",
        generic:
          "Что-то пошло не так при входе. Попробуйте ещё раз чуть позже.",
        genericWithMessage:
          "Что-то пошло не так при входе. Попробуйте ещё раз чуть позже.",
      },
    },
    blocked: {
      titleDisabled: "Аккаунт отключен",
      descriptionDisabled:
        "Ваш аккаунт сейчас отключен. Доступ к защищенным разделам ограничен.",
      titleExpired: "Доступ истек",
      descriptionExpired:
        "Срок доступа завершен. Некоторые разделы недоступны до продления.",
      renewalMessage:
        "Чтобы продолжить обучение, свяжитесь с поддержкой и запросите продление.",
      continueOnboarding: "Продолжить онбординг",
      logout: "Выйти",
    },
    student: {
      layout: {
        title: "Панель студента",
        roleLabel: "Студент",
        brand: "StoryWalkers Club",
        searchPlaceholder: "Поиск по архиву...",
        levelLabel: "Уровень {{ level }}",
        workspaceTitle: "StoryWalkers",
        workspaceSubtitle: "",
        navDashboard: "Дашборд",
        navCourses: "Мои курсы",
        navLibrary: "Библиотека",
        navCommunity: "Сообщество",
        tipTitle: "Совет",
        tipBody: "Пройдите 3 урока, чтобы открыть бейдж «Gold Quill».",
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
        progressCounter: "{{ done }} из {{ total }} шагов выполнено",
        goalLabel: "Цель",
        goalFallbackTitle: "Учебная цель",
        goalFallbackDescription: "Ваш персональный путь обучения.",
        goalThumbnailAlt: "Иконка цели",
        stepsTitle: "Шаги пути",
        stepsDescription: "Проходите путь по порядку.",
        stepsEmpty: "Шагов пока нет. Задайте вопрос или изучите библиотеку.",
        coursesEmpty: "У вас пока нет доступных курсов.",
        chooseCourses: "Выбрать курсы",
        legacyCourseTitle: "Общий путь",
        courseTabEyebrow: "Путь курса",
        courseProgress: "Завершено {{ done }} из {{ total }} шагов · {{ percent }}%",
        courseStepsEmpty: "Для этого курса пока нет шагов пути.",
        trialLesson: "Посмотреть пробный урок",
        stepsAskQuestion: "Задать вопрос",
        stepsBrowseLibrary: "Открыть библиотеку",
        markDone: "Отметить выполненным",
        markNotDone: "Снять отметку выполнения",
        currentStepTitle: "Текущий шаг",
        currentStepDescription: "Следующий невыполненный шаг вашего пути.",
        currentStepLabel: "Следующее действие",
        currentStepMaterial: "Открыть материалы",
        currentStepMarkDone: "Отметить выполненным",
        currentStepEmpty: "Все шаги выполнены. Отличная работа!",
        stepLocked: "Сначала завершите предыдущие шаги",
        completeDialogTitle: "Завершить шаг",
        completeDialogDescription:
          "При необходимости добавьте комментарий или ссылку.",
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
        greetingEyebrow: "Ваше пространство обучения",
        welcomeBack: "С возвращением, {{ name }}",
        weeklyGoalProgress:
          "Ваш путь обучения ждёт вас. Вы выполнили {{ percent }}% вашей цели.",
        statusInProgress: "В процессе",
        progressLabel: "Прогресс",
        continueJourney: "Продолжить путь",
        ongoingCourses: "Текущий путь",
        completedLessons: "Завершённые шаги",
        nextMilestone: "Следующая веха",
        milestoneProgress: "Завершено шагов: {{ done }} из {{ total }}",
        recentActivityTitle: "Недавняя активность",
        viewAll: "Смотреть всё",
        activityCurrentFocus: "Текущий фокус",
        activityCompletedStep: "Завершённый шаг",
        activityGoalProgress: "Прогресс по цели",
        resourcesTitle: "Материалы",
        resourceLatestMaterial: "Последний материал",
        resourceSavedDocuments: "Сохранённые документы",
        resourceMentorSupport: "Поддержка ментора",
        browseFullLibrary: "Открыть всю библиотеку",
        pathMapAriaLabel: "Карта учебного пути",
        doneCommentLabel: "Комментарий:",
        doneLinkLabel: "Ссылка:",
      },
      questionsRail: {
        illustrationAlt: "Иллюстрация вопросов",
        tipsTitle: "Подсказки",
        tipOne: "Опишите, что вы уже попробовали.",
        tipTwo: "Добавьте ссылки, скриншоты или примеры.",
        tipThree: "Один запрос — один вопрос.",
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
        askBody: "Не нашли нужный ответ?",
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
        filtersDescription: "Ищите по заголовку, описанию или статусу.",
        searchPlaceholder: "Искать по заголовку или деталям",
        statusAll: "Все",
        statusNew: "Новые",
        statusAnswered: "Отвеченные",
        questionsTitle: "Вопросы",
        generalCategory: "Общее",
      },
      questionNew: {
        title: "Задать вопрос",
        subtitle: "Добавьте достаточно деталей, чтобы наставники могли помочь быстрее.",
        cardTitle: "Новый вопрос",
        selectCategory: "Выберите категорию",
        titleLabel: "Заголовок",
        detailsLabel: "Подробности",
        titlePlaceholder: "Как убрать фоновый шум?",
        detailsPlaceholder: "Опишите вашу ситуацию и в чём нужна помощь",
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
        courses: "Курсы",
        coursesBody:
          "Добавляйте новые курсы в свой план после подтверждения оплаты.",
        browseCourses: "Открыть курсы",
        learningIllustrationAlt: "Иллюстрация обучения",
        questionsAlt: "Вопросы",
        libraryAlt: "Библиотека",
      },
      courses: {
        title: "Дополнительные курсы",
        description:
          "Выберите дополнительные курсы, чтобы добавить их в учебный план после подтверждения оплаты.",
        loading: "Загрузка курсов…",
        emptyAvailable: "Сейчас нет доступных дополнительных курсов.",
        selectedCount: "Выбрано: {{ count }}",
        createPaymentInstructions: "Создать инструкции по оплате",
        ownedTitle: "Ваши курсы",
        paymentInstructionsTitle: "Инструкции по оплате",
        activationCode: "Код активации",
        amount: "Сумма: {{ amount }}",
        openPaymentPage: "Открыть страницу оплаты",
        refreshCourses: "Обновить курсы",
        selectAtLeastOne: "Выберите хотя бы один курс.",
        freeAccessHint:
          "Вы входите в первую сотню учеников. Эти курсы доступны вам бесплатно.",
        buyLesson: "Купить урок",
        lessonPrice: "за урок",
        ownedLesson: "Куплено",
        lessonMode: "Купить отдельные уроки",
        courseMode: "Купить весь курс",
        upgradeHint:
          "У вас уже есть {{ count }} ур. из этого курса. Цена апгрейда: {{ price }}",
        lessonsNotAvailable: "Отдельные уроки недоступны для этого курса.",
      },
    onboarding: {
        common: {
          saving: "Сохранение...",
          saveAndContinue: "Сохранить и продолжить",
        },
        profile: {
          title: "Расскажите о себе",
          subtitle:
            "Данный шаг это ваша личная информация. Конечно вы можете не делится ей и остаться инкогнито, но чем лучше наша команда знает вас тем легче нам будет помочь вам в обучении.  Мы просматриваем ваши социальные сети и в соответствии с этим делаем выводы позволяющие оптимизировать процесс обучения.",
          cardTitle: "Профиль",
          cardDescription:
            "Заполните базовую информацию о себе. Telegram обязателен. Ссылки на соцсети можно добавить по желанию.",
          firstNameLabel: "Имя",
          firstNamePlaceholder: "Алекс",
          lastNameLabel: "Фамилия",
          lastNamePlaceholder: "Доу",
          emailLabel: "Имейл",
          aboutMeLabel: "О себе",
          aboutMePlaceholder:
            "Расскажите о ваших целях, текущем уровне и том, чего вы ждёте от StoryWalkers.",
          aboutMeRequired: "Поле «О себе» обязательно.",
          telegramLabel: "Telegram",
          telegramPlaceholder: "@username",
          telegramHelp:
            "Для Telegram-хэндла символ “@” добавляется автоматически. Номер телефона сюда вводить нельзя.",
          telegramRequired: "Поле Telegram обязательно.",
          telegramPhoneError:
            "Telegram должен быть хэндлом, а не номером телефона.",
          socialLinksLabel: "Ссылки на соцсети",
          socialLinkPlaceholder: "https://instagram.com/yourname",
          socialLinkError: "Каждая ссылка на соцсеть должна быть корректным URL.",
          addSocialLink: "Добавить ссылку",
          removeSocialLink: "Удалить ссылку",
          disclaimer:
            "Профиль проверяет человек. Активация выполняется вручную после проверки.",
          back: "Назад",
          submit: "Сохранить профиль",
          next: "Далее",
        },
        checkout: {
          title: "Оплата",
          subtitle: "Проверьте выбранное перед оплатой.",
          cardTitle: "Сводка",
          goalLabel: "Цель:",
          goalEmpty: "Цель не выбрана",
          coursesLabel: "Выбранные пути:",
          coursesEmpty: "Пути не выбраны",
          lessonsLabel: "Выбранные уроки:",
          communityLabel: "Сообщество Сториходцы",
          totalLabel: "Итого:",
          boostyCta: "Перейти в Boosty",
          firstHundredCardTitle: "Поздравляем!",
          firstHundredCardBody:
            "Вы один из первых 100 учеников на нашей платформе. Все доступные сейчас и все будущие курсы будут для вас бесплатными.",
          afterPaymentTitle: "Что дальше",
          afterPaymentManual:
            "Доступ активируется вручную после проверки. Пожалуйста, дождитесь подтверждения от команды.",
          afterPaymentFree:
            "Вы входите в первую сотню учеников. Доступ открывается автоматически.",
          activatedMessage: "Доступ открыт.",
          dashboardCta: "Перейти в кабинет",
          afterPaymentContactLabel: "Если вы оплатили, напишите в поддержку:",
          removeCourse: "Удалить",
          backToCourses: "Вернуться к выбору пути",
          removeError: "Не удалось обновить выбранные пути.",
          saveError: "Не удалось сохранить выбранные пути.",
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
