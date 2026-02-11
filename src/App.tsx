import PageShell from './components/PageShell';
import { RouterProvider, useRouter } from './router';
import HomeRecipient from './pages/HomeRecipient';
import Create from './pages/Create';
import RecipientBySlug from './pages/RecipientBySlug';
import Results from './pages/Results';

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
      return <HomeRecipient />;
  }
}

function AppShell() {
  const { route } = useRouter();
  const background = route.name === 'results' ? 'sparkles' : 'romance';

  return (
    <PageShell background={background}>
      <AppRoutes />
    </PageShell>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppShell />
    </RouterProvider>
  );
}
