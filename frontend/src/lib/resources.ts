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
        Monthly: 'Месячный',
        Yearly: 'Годовой',
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
      message: 'Этот экран доступен главному тренеру и администратору.',
    },
    expiringMemberships: {
      title: 'Истекающие абонементы',
      description:
        'Только клиенты, у которых абонемент скоро закончится.',
      loadingErrorTitle: 'Список не загрузился',
      loadingErrorMessage:
        'Не удалось загрузить клиентов с истекающими абонементами.',
      emptyTitle: 'Истекающих абонементов сейчас нет.',
      emptyDescription:
        'Экран остается узким operational-списком и не показывает дополнительные виджеты.',
      audienceBadge: 'Главный тренер и администратор',
      openClientAction: 'Карточка клиента',
      fields: {
        membershipType: 'Тип абонемента',
        expirationDate: 'Дата окончания',
        daysUntilExpiration: 'Дней до окончания',
        payment: 'Оплата',
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
      badge: 'Команда и доступ',
      title: 'Пользователи и роли команды',
      description:
        'Экран списка показывает состав команды, статус активности и пользователей, которым нужно сменить временный пароль.',
      createAction: 'Создать пользователя',
      metrics: {
        total: {
          label: 'Пользователи',
          description: 'Всего доступных учетных записей',
        },
        active: {
          label: 'Активные',
          description: 'Активные учетные записи',
        },
        passwordRotation: {
          label: 'Смена пароля',
          description: 'Нужна обязательная смена пароля',
        },
      },
      sectionTitle: 'Список пользователей',
      sectionDescription:
        'Откройте карточку пользователя, чтобы изменить роль и доступ.',
      headCoachOnlyBadge: 'Только для главного тренера',
      loadingErrorTitle: 'Список не загрузился',
      loadingErrorMessage: 'Не удалось загрузить список пользователей.',
      emptyTitle: 'Пользователи пока не заведены',
      emptyDescription:
        'Создайте администратора или тренера, чтобы выдать доступ к рабочим сценариям Gym CRM.',
      loginPrefix: 'Логин',
      telegramIdPrefix: 'Telegram ID',
      editAction: 'Редактировать',
      passwordActual: 'Пароль актуален',
      passwordRotationRequired: 'Требуется смена пароля',
    },
    create: {
      badge: 'Создание пользователя',
      title: 'Новая учетная запись',
      description:
        'Главный тренер может сразу назначить роль, включить доступ и потребовать смену временного пароля.',
      backAction: 'Назад к списку',
      sectionTitle: 'Данные пользователя',
      sectionDescription: 'Логин меняется только на этапе создания.',
      submit: 'Сохранить пользователя',
      loadingHintTitle: 'Поведение после сохранения',
      loadingHintDescription:
        'Backend сам проверяет права, сохраняет роль, активность и аудит события создания пользователя.',
      errorTitle: 'Создание не выполнено',
      fallbackError: 'Не удалось создать пользователя. Попробуйте еще раз.',
      successTitle: 'Пользователь создан',
      successMessage: 'Новая учетная запись сохранена в системе.',
    },
    edit: {
      badge: 'Редактирование пользователя',
      fallbackTitle: 'Карточка пользователя',
      description:
        'Логин нельзя изменить после создания. Роль, активность и требование смены пароля можно обновить в карточке.',
      backAction: 'Назад к списку',
      sectionTitle: 'Редактирование доступа',
      sectionDescription: 'Логин фиксируется после создания пользователя.',
      loadingErrorTitle: 'Карточка не загрузилась',
      loadingErrorMessage: 'Не удалось загрузить пользователя.',
      submit: 'Сохранить изменения',
      errorTitle: 'Изменения не сохранены',
      fallbackError: 'Не удалось сохранить пользователя. Попробуйте еще раз.',
      successTitle: 'Изменения сохранены',
      successMessage: 'Карточка пользователя обновлена.',
      permissionsHintTitle: 'Что можно менять на этом экране',
      permissionsHintDescription:
        'Доступны ФИО, роль, активность, Telegram ID и флаг обязательной смены пароля. При очистке Telegram ID пользователь теряет доступ к боту. Логин остается только для просмотра.',
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
        isActive: 'Пользователь активен',
        mustChangePassword: 'Требовать смену пароля при входе',
      },
      descriptions: {
        messengerPlatform: 'Для MVP доступен только Telegram.',
        messengerPlatformUserId:
          'Попросите пользователя прислать ID из /start или /id бота. Если очистить поле, пользователь потеряет доступ к боту.',
      },
      placeholders: {
        fullName: 'Иван Петров',
        login: 'coach.petrov',
        password: 'Введите пароль',
        messengerPlatform: 'Не подключено',
        messengerPlatformUserId: 'Например, 123456789',
      },
      validation: {
        fullNameRequired: 'Введите ФИО пользователя.',
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
    membershipTypeLabels: {
      SingleVisit: 'Разовое',
      Monthly: 'Месячный',
      Yearly: 'Годовой',
    },
    membershipTypeOptionLabels: {
      SingleVisit: 'Разовое посещение',
      Monthly: 'Месячный абонемент',
      Yearly: 'Годовой абонемент',
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
      scheduleText: 'Не задано',
    },
  },
} as const
