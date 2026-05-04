import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { z } from 'zod';
import { AppLayout } from './components/AppLayout';
import { CardsPage } from './routes/CardsPage';
import { DashboardPage } from './routes/DashboardPage';
import { DatasetsPage } from './routes/DatasetsPage';
import { DatasetDetailPage } from './routes/DatasetDetailPage';
import { ErrorsPage } from './routes/ErrorsPage';
import { HeatmapPage } from './routes/HeatmapPage';
import { RunsListPage } from './routes/RunsListPage';
import { RunDetailPage } from './routes/RunDetailPage';
import { StagesPage } from './routes/StagesPage';
import { ComparePage } from './routes/ComparePage';
import { FilterSchema } from './lib/filter';

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
  path: 'runs/$runId',
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
  validateSearch: filterSearchSchema.extend({ stageId: z.string().optional() }),
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
