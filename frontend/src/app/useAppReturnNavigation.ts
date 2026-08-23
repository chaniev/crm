import { useEffect, useRef } from 'react'
import {
  getRoutePath,
  normalizePathname,
  type AppRoute,
  type ParsedRoute,
} from '../lib/appRoutes'
import {
  getClientListReturnHistoryStateForRoute,
  getNextClientListReturnDepth,
  isClientListReturnRoute,
  mergeClientListReturnSnapshotIntoHistoryState,
  readClientListReturnSnapshot,
  stripClientListReturnSnapshotFromHistoryState,
  withClientListReturnDepth,
  type ClientListReturnSnapshot,
} from '../features/clients/list/clientListReturnState'
import {
  createClientProfileReturnContext,
  getClientProfileOriginRoute,
  getClientProfileReturnHistoryStateForRoute,
  getNextClientProfileReturnDepth,
  isClientProfileScopedRoute,
  mergeClientProfileReturnContextIntoHistoryState,
  readClientProfileReturnContext,
  stripClientProfileReturnContextFromHistoryState,
  withClientProfileReturnDepth,
  type ClientProfileOriginInput,
  type ClientProfileReturnContext,
} from '../features/clients/clientProfileReturnState'
import {
  getGroupListReturnHistoryStateForRoute,
  getNextGroupListReturnDepth,
  isGroupListReturnRoute,
  mergeGroupListReturnSnapshotIntoHistoryState,
  readGroupListReturnSnapshot,
  stripGroupListReturnSnapshotFromHistoryState,
  withGroupListReturnDepth,
  type GroupListReturnSnapshot,
} from '../features/groups/groupListReturnState'
import {
  isAppRoute,
  isClientProfileOriginInput,
  stripAppReturnSnapshotsFromHistoryState,
  type NavigateOptions,
  type PendingClientProfileReturn,
} from './useAppRoute'

type UseAppReturnNavigationOptions = {
  canManageClients: boolean
  navigate: (nextRoute: AppRoute | string, options?: NavigateOptions) => void
  route: ParsedRoute
}

function getCurrentClientListReturnDepth(
  route: ParsedRoute,
  snapshot: ClientListReturnSnapshot,
) {
  if (route.kind === 'not-found' || route.kind === 'password') {
    return snapshot.returnDepth
  }

  if (route.kind === 'section' && route.section === 'Clients') {
    return 0
  }

  if (route.kind === 'clientPreview') {
    return Math.max(1, snapshot.returnDepth)
  }

  return snapshot.returnDepth
}

function getCurrentGroupListReturnDepth(
  route: ParsedRoute,
  snapshot: GroupListReturnSnapshot,
) {
  if (route.kind === 'not-found' || route.kind === 'password') {
    return snapshot.returnDepth
  }

  if (route.kind === 'section' && route.section === 'Groups') {
    return 0
  }

  return snapshot.returnDepth
}

export function getClientProfileBackLabel(
  route: ParsedRoute,
  context: ClientProfileReturnContext | null,
) {
  if (
    !context ||
    !isAppRoute(route) ||
    !isClientProfileScopedRoute(route, context)
  ) {
    return 'К списку клиентов'
  }

  return context.origin.kind === 'attendance' ? 'К посещениям' : 'К группе'
}

export function useAppReturnNavigation({
  canManageClients,
  navigate,
  route,
}: UseAppReturnNavigationOptions) {
  const pendingClientProfileReturnRef =
    useRef<PendingClientProfileReturn | null>(null)
  const routeClientListReturnSnapshot = readClientListReturnSnapshot(
    window.history.state,
    {
      canSeeWithoutGroup: canManageClients,
    },
  )
  const activeClientListReturnSnapshot = routeClientListReturnSnapshot
  const routeGroupListReturnSnapshot = readGroupListReturnSnapshot(
    window.history.state,
  )
  const activeGroupListReturnSnapshot = routeGroupListReturnSnapshot
  const activeClientProfileReturnContext = readClientProfileReturnContext(
    window.history.state,
  )

  useEffect(() => {
    const pendingReturn = pendingClientProfileReturnRef.current
    if (!pendingReturn) {
      return
    }

    pendingClientProfileReturnRef.current = null
    const landedContext = readClientProfileReturnContext(window.history.state)
    const landedPath = normalizePathname(window.location.pathname)
    const expectedPath = getRoutePath(pendingReturn.originRoute)
    const landedOnExpectedOrigin =
      landedPath === expectedPath &&
      landedContext?.originEntryKey === pendingReturn.originEntryKey &&
      landedContext.returnDepth === 0 &&
      isAppRoute(route) &&
      getRoutePath(getClientProfileOriginRoute(landedContext)) === expectedPath

    if (landedOnExpectedOrigin) {
      return
    }

    navigate(
      { kind: 'section', section: 'Clients' },
      {
        replace: true,
        state: stripAppReturnSnapshotsFromHistoryState(window.history.state),
      },
    )
  }, [navigate, route])

  function getClientListHistoryState(
    nextRoute: AppRoute,
    snapshot: ClientListReturnSnapshot | null,
  ) {
    return stripClientProfileReturnContextFromHistoryState(
      stripGroupListReturnSnapshotFromHistoryState(
        getClientListReturnHistoryStateForRoute(
          window.history.state,
          nextRoute,
          snapshot,
        ),
      ),
    )
  }

  function saveClientListReturnState(snapshot: ClientListReturnSnapshot) {
    const entrySnapshot = withClientListReturnDepth(
      snapshot,
      getCurrentClientListReturnDepth(route, snapshot),
    )

    window.history.replaceState(
      mergeClientListReturnSnapshotIntoHistoryState(
        stripGroupListReturnSnapshotFromHistoryState(window.history.state),
        entrySnapshot,
      ),
      '',
      window.location.pathname,
    )
  }

  function navigateWithClientListReturnState(
    nextRoute: AppRoute,
    snapshot: ClientListReturnSnapshot | null,
    options: Omit<NavigateOptions, 'state'> = {},
  ) {
    if (
      snapshot &&
      ((route.kind === 'section' && route.section === 'Clients') ||
        route.kind === 'clientPreview')
    ) {
      saveClientListReturnState(snapshot)
    }

    const targetSnapshot = snapshot
      ? withClientListReturnDepth(
          snapshot,
          isAppRoute(route)
            ? getNextClientListReturnDepth(route, snapshot)
            : snapshot.returnDepth,
        )
      : null
    const nextState = getClientListHistoryState(nextRoute, targetSnapshot)

    navigate(nextRoute, {
      ...options,
      state: nextState,
    })
  }

  function getGroupListHistoryState(
    nextRoute: AppRoute,
    snapshot: GroupListReturnSnapshot | null,
  ) {
    return stripClientProfileReturnContextFromHistoryState(
      stripClientListReturnSnapshotFromHistoryState(
        getGroupListReturnHistoryStateForRoute(
          window.history.state,
          nextRoute,
          snapshot,
        ),
      ),
    )
  }

  function saveGroupListReturnState(snapshot: GroupListReturnSnapshot) {
    const entrySnapshot = withGroupListReturnDepth(
      snapshot,
      getCurrentGroupListReturnDepth(route, snapshot),
    )

    window.history.replaceState(
      mergeGroupListReturnSnapshotIntoHistoryState(
        stripClientListReturnSnapshotFromHistoryState(window.history.state),
        entrySnapshot,
      ),
      '',
      window.location.pathname,
    )
  }

  function navigateWithGroupListReturnState(
    nextRoute: AppRoute,
    snapshot: GroupListReturnSnapshot | null,
    options: Omit<NavigateOptions, 'state'> = {},
  ) {
    if (snapshot && route.kind === 'section' && route.section === 'Groups') {
      saveGroupListReturnState(snapshot)
    }

    const targetSnapshot = snapshot
      ? withGroupListReturnDepth(
          snapshot,
          isAppRoute(route)
            ? getNextGroupListReturnDepth(route, snapshot)
            : snapshot.returnDepth,
        )
      : null
    const nextState = getGroupListHistoryState(nextRoute, targetSnapshot)

    navigate(nextRoute, {
      ...options,
      state: nextState,
    })
  }

  function saveClientProfileReturnContext(context: ClientProfileReturnContext) {
    window.history.replaceState(
      mergeClientProfileReturnContextIntoHistoryState(
        window.history.state,
        context,
      ),
      '',
      window.location.pathname,
    )
  }

  function navigateWithClientProfileReturnContext(
    nextRoute: AppRoute,
    context: ClientProfileReturnContext,
    options: Omit<NavigateOptions, 'state'> = {},
  ) {
    const targetContext = withClientProfileReturnDepth(
      context,
      isAppRoute(route)
        ? getNextClientProfileReturnDepth(route, context)
        : context.returnDepth,
    )
    const nextState = getClientProfileReturnHistoryStateForRoute(
      window.history.state,
      nextRoute,
      targetContext,
    )

    navigate(nextRoute, {
      ...options,
      state: nextState,
    })
  }

  function openClientFromProfileOrigin(
    clientId: string,
    origin: ClientProfileOriginInput,
  ) {
    const originContext = createClientProfileReturnContext({
      origin,
      returnDepth: 0,
    })

    saveClientProfileReturnContext(originContext)
    navigateWithClientProfileReturnContext(
      { kind: 'clientDetails', clientId },
      originContext,
    )
  }

  function openClientDetails(
    clientId: string,
    returnSnapshotOrOrigin?: ClientListReturnSnapshot | ClientProfileOriginInput | null,
  ) {
    if (isClientProfileOriginInput(returnSnapshotOrOrigin)) {
      openClientFromProfileOrigin(clientId, returnSnapshotOrOrigin)
      return
    }

    if (
      activeClientProfileReturnContext &&
      isAppRoute(route) &&
      isClientProfileScopedRoute(route, activeClientProfileReturnContext)
    ) {
      navigateWithClientProfileReturnContext(
        { kind: 'clientDetails', clientId },
        activeClientProfileReturnContext,
      )
      return
    }

    navigateWithClientListReturnState(
      { kind: 'clientDetails', clientId },
      returnSnapshotOrOrigin ?? activeClientListReturnSnapshot,
    )
  }

  function editClient(clientId: string) {
    if (
      activeClientProfileReturnContext &&
      isAppRoute(route) &&
      isClientProfileScopedRoute(route, activeClientProfileReturnContext)
    ) {
      navigateWithClientProfileReturnContext(
        { kind: 'clientEdit', clientId },
        activeClientProfileReturnContext,
      )
      return
    }

    navigate({ kind: 'clientEdit', clientId })
  }

  function returnToClients() {
    if (
      (route.kind === 'clientDetails' || route.kind === 'clientEdit') &&
      activeClientProfileReturnContext &&
      isClientProfileScopedRoute(route, activeClientProfileReturnContext)
    ) {
      if (activeClientProfileReturnContext.returnDepth > 0) {
        pendingClientProfileReturnRef.current = {
          originEntryKey: activeClientProfileReturnContext.originEntryKey,
          originRoute: getClientProfileOriginRoute(activeClientProfileReturnContext),
        }
        window.history.go(-activeClientProfileReturnContext.returnDepth)
        return
      }

      const originRoute = getClientProfileOriginRoute(activeClientProfileReturnContext)
      navigate(originRoute, {
        replace: true,
        state: getClientProfileReturnHistoryStateForRoute(
          window.history.state,
          originRoute,
          withClientProfileReturnDepth(activeClientProfileReturnContext, 0),
        ),
      })
      return
    }

    if (
      (route.kind === 'clientDetails' || route.kind === 'clientPreview') &&
      activeClientListReturnSnapshot &&
      activeClientListReturnSnapshot.returnDepth > 0
    ) {
      window.history.go(-activeClientListReturnSnapshot.returnDepth)
      return
    }

    navigate(
      { kind: 'section', section: 'Clients' },
      {
        replace: route.kind === 'clientDetails' || route.kind === 'clientPreview',
        state: stripAppReturnSnapshotsFromHistoryState(window.history.state),
      },
    )
  }

  function returnToGroups() {
    if (
      route.kind === 'groupEdit' &&
      activeGroupListReturnSnapshot &&
      activeGroupListReturnSnapshot.returnDepth > 0
    ) {
      window.history.go(-activeGroupListReturnSnapshot.returnDepth)
      return
    }

    navigate(
      { kind: 'section', section: 'Groups' },
      {
        replace: route.kind === 'groupEdit',
        state: stripAppReturnSnapshotsFromHistoryState(window.history.state),
      },
    )
  }

  useEffect(() => {
    if (
      !isAppRoute(route) ||
      (!isClientListReturnRoute(route) && !isGroupListReturnRoute(route))
    ) {
      return
    }

    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [route])

  return {
    activeClientListReturnSnapshot,
    activeClientProfileReturnContext,
    activeGroupListReturnSnapshot,
    editClient,
    openClientDetails,
    returnToClients,
    returnToGroups,
    saveClientListReturnState,
    saveGroupListReturnState,
    navigateWithClientListReturnState,
    navigateWithGroupListReturnState,
  }
}
