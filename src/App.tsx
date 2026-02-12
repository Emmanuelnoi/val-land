import PageShell from './components/PageShell';
import { RouterProvider, useRouter } from './router';
import Home from './pages/Home';
import Create from './pages/Create';
import RecipientBySlug from './pages/RecipientBySlug';
import Results from './pages/Results';
import { ThemeProvider, useTheme } from './theme';

function AppRoutes() {
  const { route } = useRouter();
  switch (route.name) {
    case 'create':
      return <Create />;
    case 'recipient':
      return <RecipientBySlug slug={route.slug} />;
    case 'results':
      return <Results slug={route.slug} adminKey={route.key} />;
    case 'home':
    default:
      return <Home />;
  }
}

function AppShell() {
  const { route } = useRouter();
  const { theme } = useTheme();
  const background = route.name === 'results' ? 'sparkles' : 'romance';

  return (
    <PageShell background={background} theme={theme}>
      <AppRoutes />
    </PageShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider>
        <AppShell />
      </RouterProvider>
    </ThemeProvider>
  );
}
