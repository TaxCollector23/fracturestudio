import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { GlobalQuickActions } from './components/GlobalQuickActions';
import { router } from './router';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <>
    <RouterProvider router={router} />
    <GlobalQuickActions />
  </>,
);
