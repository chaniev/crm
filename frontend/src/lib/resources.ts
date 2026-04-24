export const resources = {
  common: {
    actions: {
      cancel: 'Отмена',
      refresh: 'Обновить',
    },
    membership: {
      expiringWindowDays: 10,
    },
    statuses: {
      active: 'Активен',
      disabled: 'Отключен',
      paid: 'Оплачен',
      unpaid: 'Не оплачен',
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
      UserUpdated: 'Изменение пользователя',
    },
    entityLabels: {
      User: 'Пользователь',
      Client: 'Клиент',
      Group: 'Группа',
      Attendance: 'Посещаемость',
    },
  },
} as const
