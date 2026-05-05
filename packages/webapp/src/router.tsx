import { Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { AppLayout } from './components/AppLayout';
import { FilterSchema } from './lib/filter';
import { CardsPage } from './routes/CardsPage';
import { ComparePage } from './routes/ComparePage';
import { DashboardPage } from './routes/DashboardPage';
import { DatasetDetailPage } from './routes/DatasetDetailPage';
import { DatasetsPage } from './routes/DatasetsPage';
import { ErrorsPage } from './routes/ErrorsPage';
import { EventDetailPage } from './routes/EventDetailPage';
import { HeatmapPage } from './routes/HeatmapPage';
import { RunDetailPage } from './routes/RunDetailPage';
import { RunsListPage } from './routes/RunsListPage';
import { StagesPage } from './routes/StagesPage';

const filterSearchSchema = FilterSchema;

const rootRoute = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DatasetsPage,
});

const datasetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'datasets/$slug',
  component: DatasetDetailPage,
});

const eventDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'events/$eventSlug',
  component: EventDetailPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'dashboard',
  validateSearch: filterSearchSchema,
  component: DashboardPage,
});

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'runs',
  validateSearch: filterSearchSchema,
  component: RunsListPage,
});

const runDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  // slug は `<event>__<device>__<run_id>` の合成キー
  path: 'runs/$slug',
  component: RunDetailPage,
});

const cardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'cards',
  validateSearch: filterSearchSchema,
  component: CardsPage,
});

const stagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'stages',
  validateSearch: filterSearchSchema,
  component: StagesPage,
});

const heatmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'heatmap',
  validateSearch: filterSearchSchema.extend({
    mapName: z.string().optional(),
    layers: z.array(z.enum(['moves', 'presence', 'plants', 'paths'])).optional(),
    // run.started_at を Unix 秒で絞る (両端含む)
    timeFrom: z.number().optional(),
    timeTo: z.number().optional(),
  }),
  component: HeatmapPage,
});

const errorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'errors',
  validateSearch: filterSearchSchema,
  component: ErrorsPage,
});

const compareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'compare',
  component: ComparePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  datasetRoute,
  eventDetailRoute,
  dashboardRoute,
  runsRoute,
  runDetailRoute,
  cardsRoute,
  stagesRoute,
  heatmapRoute,
  errorsRoute,
  compareRoute,
]);

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
