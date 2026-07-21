export const resources = {
  common: {
    actions: {
      cancel: 'Отмена',
      open: 'Открыть',
      refresh: 'Обновить',
      resetFilters: 'Сбросить фильтры',
    },
    membership: {
      typeLabels: {
        SingleVisit: 'Разовое посещение',
        Term: 'На срок',
        Professional: 'Профессиональный',
      },
    },
    statuses: {
      active: 'Активен',
      disabled: 'Отключен',
      paid: 'Оплачен',
      unpaid: 'Не оплачен',
    },
  },
  home: {
    accessDenied: {
      title: 'Главная страница недоступна',
      message: 'Для этой учетной записи нет доступных блоков главной страницы.',
    },
    attention: {
      title: 'Клиенты, требующие внимания',
      description: 'Повторные пропуски тренировок и вопросы по абонементам.',
      loadingErrorTitle: 'Список не загрузился',
      loadingErrorMessage: 'Не удалось загрузить клиентов, требующих внимания.',
      actionError: 'Не удалось сохранить отметку',
      emptyTitle: 'Никому не требуется внимание',
      emptyDescription: 'Нет клиентов с повторными пропусками или вопросами по абонементам.',
    },
    expiringMemberships: {
      title: 'Абонементы требуют внимания',
      description:
        'Клиенты с истекшими, скоро истекающими или неоплаченными абонементами.',
      loadingErrorTitle: 'Список не загрузился',
      loadingErrorMessage:
        'Не удалось загрузить абонементы, требующие внимания.',
      emptyTitle: 'Абонементы не требуют внимания.',
      emptyDescription:
        'Нет истекших, скоро истекающих или неоплаченных абонементов.',
      openClientAction: 'Карточка клиента',
      fields: {
        behaviorKind: 'Тип абонемента',
        expirationDate: 'Дата окончания',
        state: 'Состояние',
        payment: 'Оплата',
      },
      stateLabels: {
        Expired: 'Истек',
        ExpiringSoon: 'Скоро истечет',
        Unpaid: 'Требует оплаты',
        Unknown: 'Неизвестно',
      },
      today: 'Сегодня',
    },
  },
  users: {
    roles: {
      HeadCoach: 'Главный тренер',
      Administrator: 'Администратор',
      Coach: 'Тренер',
    },
    list: {
      createAction: 'Создать тренера',
      metrics: {
        total: {
          label: 'Тренеры',
          description: 'Всего доступных тренерских учетных записей',
        },
        active: {
          label: 'Активные',
          description: 'Активные тренерские учетные записи',
        },
        passwordRotation: {
          label: 'Смена пароля',
          description: 'Нужна обязательная смена пароля',
        },
      },
      sectionTitle: 'Список тренеров',
      loadingErrorTitle: 'Список не загрузился',
      loadingErrorMessage: 'Не удалось загрузить список тренеров.',
      emptyTitle: 'Тренеры пока не заведены',
      emptyDescription:
        'Создайте тренера, чтобы выдать доступ к рабочим сценариям системы.',
      loginPrefix: 'Логин',
      telegramIdPrefix: 'Telegram ID',
      editAction: 'Редактировать',
      passwordActual: 'Пароль актуален',
      passwordRotationRequired: 'Требуется смена пароля',
    },
    create: {
      title: 'Новый тренер',
      backAction: 'Назад к списку',
      sectionTitle: 'Данные тренера',
      sectionDescription: 'Логин меняется только на этапе создания.',
      submit: 'Сохранить тренера',
      loadingHintTitle: 'Поведение после сохранения',
      loadingHintDescription:
        'Backend сам проверяет права, сохраняет роль, активность и аудит события создания тренера.',
      errorTitle: 'Создание не выполнено',
      fallbackError: 'Не удалось создать тренера. Попробуйте еще раз.',
      successTitle: 'Тренер создан',
      successMessage: 'Новая учетная запись тренера сохранена в системе.',
    },
    edit: {
      fallbackTitle: 'Карточка тренера',
      backAction: 'Назад к списку',
      sectionTitle: 'Редактирование доступа',
      sectionDescription: 'Логин фиксируется после создания тренера.',
      loadingErrorTitle: 'Карточка не загрузилась',
      loadingErrorMessage: 'Не удалось загрузить тренера.',
      submit: 'Сохранить изменения',
      errorTitle: 'Изменения не сохранены',
      fallbackError: 'Не удалось сохранить тренера. Попробуйте еще раз.',
      successTitle: 'Изменения сохранены',
      successMessage: 'Карточка тренера обновлена.',
      permissionsHintTitle: 'Что можно менять на этом экране',
      permissionsHintDescription:
        'Доступны ФИО, роль, активность, Telegram ID и флаг обязательной смены пароля. При очистке Telegram ID тренер теряет доступ к боту. Логин остается только для просмотра.',
      listAction: 'К списку',
    },
    messenger: {
      platforms: {
        Telegram: 'Telegram',
      },
    },
    form: {
      labels: {
        fullName: 'ФИО',
        role: 'Роль',
        login: 'Логин',
        password: 'Стартовый пароль',
        messengerPlatform: 'Мессенджер',
        messengerPlatformUserId: 'Telegram ID',
        isActive: 'Тренер активен',
        mustChangePassword: 'Требовать смену пароля при входе',
      },
      descriptions: {
        messengerPlatform: 'Для MVP доступен только Telegram.',
        messengerPlatformUserId:
          'Попросите тренера прислать ID из /start или /id бота. Если очистить поле, тренер потеряет доступ к боту.',
      },
      placeholders: {
        fullName: 'Иван Петров',
        login: 'coach.petrov',
        password: 'Введите пароль',
        messengerPlatform: 'Не подключено',
        messengerPlatformUserId: 'Например, 123456789',
      },
      validation: {
        fullNameRequired: 'Введите ФИО тренера.',
        loginRequired: 'Введите логин.',
        passwordRequired: 'Введите стартовый пароль.',
        roleRequired: 'Выберите роль.',
      },
    },
  },
  audit: {
    actionLabels: {
      Login: 'Вход в систему',
      Logout: 'Выход из системы',
      PasswordChanged: 'Смена пароля',
      UserCreated: 'Создание пользователя',
      UserUpdated: 'Редактирование пользователя',
      ClientCreated: 'Создание клиента',
      ClientUpdated: 'Редактирование клиента',
      ClientArchived: 'Архивирование клиента',
      ClientRestored: 'Возврат клиента из архива',
      TrainingGroupCreated: 'Создание группы',
      TrainingGroupUpdated: 'Редактирование группы',
      ClientMembershipPurchased: 'Оформление абонемента',
      ClientMembershipRenewed: 'Продление абонемента',
      ClientMembershipCorrected: 'Исправление абонемента',
      ClientMembershipPaymentMarked: 'Отметка оплаты',
      ClientMembershipSingleVisitWrittenOff: 'Списание разового посещения',
      ClientMembershipCommentChanged: 'Изменение комментария к абонементу',
      AttendanceMarked: 'Отметка посещения',
      AttendanceUpdated: 'Изменение посещения',
      BotAttendanceSaved: 'Отметка посещения из бота',
      BotMembershipPaymentMarked: 'Отметка оплаты из бота',
      BotAccessDenied: 'Отказ доступа в боте',
    },
    entityLabels: {
      UserSession: 'Сессия пользователя',
      User: 'Пользователь',
      Client: 'Клиент',
      TrainingGroup: 'Группа',
      ClientMembership: 'Абонемент',
      ClientMembershipSale: 'Покупка абонемента',
      Attendance: 'Посещение',
      BotAction: 'Действие бота',
    },
    sourceLabels: {
      Web: 'Web',
      Bot: 'Бот',
    },
    messengerPlatformLabels: {
      Telegram: 'Telegram',
    },
  },
  clients: {
    statuses: {
      Active: 'Активный',
      Archived: 'Архивный',
    },
    paymentStatuses: {
      Paid: 'Оплаченные',
      Unpaid: 'Неоплаченные',
    },
    behaviorKindLabels: {
      SingleVisit: 'Разовое',
      Term: 'На срок',
      Professional: 'Профессиональный',
    },
    behaviorKindOptionLabels: {
      SingleVisit: 'Разовое посещение',
      Term: 'Абонемент на срок',
      Professional: 'Профессиональный',
    },
    membershipChangeReasonLabels: {
      NewPurchase: 'Новая покупка',
      Renewal: 'Продление',
      Correction: 'Исправление',
      PaymentUpdate: 'Оплата отмечена',
      SingleVisitWriteOff: 'Списание разового',
    },
    list: {
      membershipChangeReasonLabels: {
        NewPurchase: 'Оформлен абонемент',
        Renewal: 'Продление',
        Correction: 'Исправление',
        PaymentUpdate: 'Оплата отмечена',
        SingleVisitWriteOff: 'Разовое списано',
      },
      quickFilters: {
        withoutMembership: 'Без абонемента',
        expiringSoon: 'Скоро закончится',
        withoutGroup: 'Без группы',
        trial: 'Пробные',
      },
      statusFilters: {
        Active: 'Активные',
        all: 'Все',
        Archived: 'Архив',
      },
    },
  },
  groups: {
    statuses: {
      active: 'Активна',
      inactive: 'Неактивна',
    },
    formFallbacks: {
      trainingStartTime: 'Не задан',
      durationMinutes: 'Не задана',
      weekdays: 'Дни не заданы',
    },
  },
} as const
